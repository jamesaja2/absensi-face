const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { query } = require('../db');
const { recognizeFaceFromBuffer } = require('../services/compreface');
const { checkLiveness } = require('../services/antispoof');
const { recordAttendance, inquireAttendance, CONFIDENCE_THRESHOLD } = require('../services/attendanceService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Memory storage for fast processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── GET /api/attendance ──────────────────────────────────────────────────────
// Query params: start_date, end_date, date, user_id, kiosk_id, search, limit, page
router.get('/', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      date,
      user_id,
      kiosk_id,
      search,
      limit = 50,
      page = 1,
    } = req.query;

    const parsedLimit = Math.max(1, Math.min(500, parseInt(limit) || 50));
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const whereConditions = [];
    const params = [];
    let idx = 1;

    if (date) {
      whereConditions.push(`al.timestamp::date = $${idx++}::date`);
      params.push(date);
    } else {
      if (start_date) {
        whereConditions.push(`al.timestamp::date >= $${idx++}::date`);
        params.push(start_date);
      }
      if (end_date) {
        whereConditions.push(`al.timestamp::date <= $${idx++}::date`);
        params.push(end_date);
      }
    }

    if (user_id) {
      whereConditions.push(`al.user_id = $${idx++}`);
      params.push(user_id);
    }

    if (kiosk_id && kiosk_id !== 'all') {
      whereConditions.push(`al.kiosk_id = $${idx++}`);
      params.push(kiosk_id);
    }

    if (search) {
      whereConditions.push(`(LOWER(u.name) LIKE $${idx} OR LOWER(u.nomor_induk) LIKE $${idx} OR LOWER(COALESCE(u.email, '')) LIKE $${idx})`);
      params.push(`%${search.trim().toLowerCase()}%`);
      idx++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countSql = `
      SELECT COUNT(*) as total
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      LEFT JOIN kiosks k ON al.kiosk_id = k.kiosk_id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total);

    const dataSql = `
      SELECT 
        al.id,
        al.timestamp,
        al.status,
        al.confidence,
        al.is_real,
        al.liveness_score,
        al.kiosk_id,
        COALESCE(k.name, al.kiosk_id) as kiosk_name,
        u.id as user_id,
        u.name,
        u.nomor_induk,
        u.email,
        u.photo_url
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      LEFT JOIN kiosks k ON al.kiosk_id = k.kiosk_id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const dataParams = [...params, parsedLimit, offset];
    const dataRes = await query(dataSql, dataParams);

    res.json({
      logs: dataRes.rows,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/analytics ───────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    // 1. Overall stats today
    const todayStatsRes = await query(`
      SELECT 
        COUNT(*) as total_attendance_today,
        COUNT(DISTINCT user_id) as unique_users_today,
        COALESCE(AVG(confidence), 0) as avg_confidence_today
      FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE
    `);
    const todayStats = todayStatsRes.rows[0];

    // 2. Total registered users
    const totalUsersRes = await query('SELECT count(*) as count FROM users');
    const totalUsers = parseInt(totalUsersRes.rows[0].count);

    // 3. Total active/approved kiosks
    const totalKiosksRes = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending
      FROM kiosks
    `);
    const kioskStats = totalKiosksRes.rows[0];

    // 4. Hourly breakdown today (06:00 to 20:00)
    const hourlyRes = await query(`
      SELECT 
        TO_CHAR(timestamp, 'HH24:00') as hour,
        COUNT(*) as count
      FROM attendance_logs
      WHERE timestamp::date = CURRENT_DATE
      GROUP BY TO_CHAR(timestamp, 'HH24:00')
      ORDER BY hour ASC
    `);

    // 5. Attendance by kiosk today
    const kioskBreakdownRes = await query(`
      SELECT 
        COALESCE(k.name, al.kiosk_id, 'Kiosk') as kiosk_name,
        al.kiosk_id,
        COUNT(*) as count
      FROM attendance_logs al
      LEFT JOIN kiosks k ON al.kiosk_id = k.kiosk_id
      WHERE al.timestamp::date = CURRENT_DATE
      GROUP BY al.kiosk_id, k.name
      ORDER BY count DESC
      LIMIT 8
    `);

    // 6. 7-day trend
    const weeklyTrendRes = await query(`
      SELECT 
        TO_CHAR(d.day, 'YYYY-MM-DD') as date,
        TO_CHAR(d.day, 'Dy') as day_name,
        COUNT(al.id) as count
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
      LEFT JOIN attendance_logs al ON al.timestamp::date = d.day::date
      GROUP BY d.day
      ORDER BY d.day ASC
    `);

    // 7. Recent 10 logs
    const recentLogsRes = await query(`
      SELECT 
        al.id, al.timestamp, al.status, al.confidence, al.kiosk_id,
        COALESCE(k.name, al.kiosk_id) as kiosk_name,
        u.name, u.nomor_induk, u.photo_url
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      LEFT JOIN kiosks k ON al.kiosk_id = k.kiosk_id
      ORDER BY al.timestamp DESC
      LIMIT 10
    `);

    res.json({
      today: {
        totalAttendance: parseInt(todayStats.total_attendance_today),
        uniqueUsers: parseInt(todayStats.unique_users_today),
        avgConfidence: parseFloat(todayStats.avg_confidence_today).toFixed(1),
        totalRegisteredUsers: totalUsers,
        attendanceRate: totalUsers > 0 ? Math.round((parseInt(todayStats.unique_users_today) / totalUsers) * 100) : 0,
      },
      kiosks: {
        total: parseInt(kioskStats.total),
        approved: parseInt(kioskStats.approved),
        pending: parseInt(kioskStats.pending),
      },
      hourly: hourlyRes.rows,
      byKiosk: kioskBreakdownRes.rows,
      weeklyTrend: weeklyTrendRes.rows,
      recentLogs: recentLogsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/attendance/export-excel ─────────────────────────────────────────
// Export attendance as rich formatted Excel (.xlsx)
router.get('/export-excel', async (req, res) => {
  try {
    const { start_date, end_date, date, kiosk_id, user_id } = req.query;

    const whereConditions = [];
    const params = [];
    let idx = 1;

    if (date) {
      whereConditions.push(`al.timestamp::date = $${idx++}::date`);
      params.push(date);
    } else {
      if (start_date) {
        whereConditions.push(`al.timestamp::date >= $${idx++}::date`);
        params.push(start_date);
      }
      if (end_date) {
        whereConditions.push(`al.timestamp::date <= $${idx++}::date`);
        params.push(end_date);
      }
    }

    if (kiosk_id && kiosk_id !== 'all') {
      whereConditions.push(`al.kiosk_id = $${idx++}`);
      params.push(kiosk_id);
    }

    if (user_id) {
      whereConditions.push(`al.user_id = $${idx++}`);
      params.push(user_id);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT 
        al.id,
        u.name,
        u.nomor_induk,
        u.email,
        al.timestamp,
        COALESCE(k.name, al.kiosk_id, '-') as kiosk_name,
        al.kiosk_id,
        al.status,
        al.confidence,
        al.is_real,
        al.liveness_score
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
      LEFT JOIN kiosks k ON al.kiosk_id = k.kiosk_id
      ${whereClause}
      ORDER BY al.timestamp DESC
    `;

    const result = await query(sql, params);
    const rows = result.rows;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Absensi Face Recognition';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Laporan Kehadiran', {
      views: [{ showGridLines: true }],
    });

    // Title Block
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LAPORAN REKAPITULASI PRESENSI & DETEKSI WAJAH';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 36;

    // Subtitle / Filter Info
    worksheet.mergeCells('A2:H2');
    const infoCell = worksheet.getCell('A2');
    const dateRangeStr = start_date && end_date
      ? `Periode: ${start_date} s/d ${end_date}`
      : date ? `Tanggal: ${date}` : `Semua Periode (Total: ${rows.length} catatan)`;
    infoCell.value = `${dateRangeStr} | Diunduh pada: ${new Date().toLocaleString('id-ID')}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    worksheet.addRow([]); // Blank separator row

    // Table Header
    const headerRow = worksheet.addRow([
      'No',
      'Nama Karyawan / Siswa',
      'Nomor Induk',
      'Email',
      'Waktu Absen (WIB)',
      'Kiosk Pengabsen',
      'Tingkat Kepercayaan (%)',
      'Anti-Spoofing (Liveness)',
    ]);
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }, // Dark Slate 900
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    // Populate rows
    rows.forEach((r, idx) => {
      const formattedDate = new Date(r.timestamp).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const row = worksheet.addRow([
        idx + 1,
        r.name,
        r.nomor_induk,
        r.email || '-',
        formattedDate,
        r.kiosk_name,
        r.confidence ? `${r.confidence.toFixed(1)}%` : '-',
        r.is_real ? `Asli (${((r.liveness_score || 1) * 100).toFixed(1)}%)` : 'Spoof Terdeteksi',
      ]);
      row.height = 22;

      // Alternating zebra striping
      const isEven = idx % 2 === 0;
      row.eachCell((cell, colNumber) => {
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }, // Slate 50
          };
        }
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 7 || colNumber === 8) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
      });
    });

    // Auto-fit column widths
    worksheet.columns = [
      { key: 'no', width: 6 },
      { key: 'name', width: 28 },
      { key: 'nomor_induk', width: 18 },
      { key: 'email', width: 24 },
      { key: 'timestamp', width: 22 },
      { key: 'kiosk_name', width: 22 },
      { key: 'confidence', width: 22 },
      { key: 'liveness', width: 24 },
    ];

    const filename = `Laporan_Absensi_${start_date || 'semua'}_sd_${end_date || 'terbaru'}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Attendance Export] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/attendance/recognize ───────────────────────────────────────────
// Accepts frame from kiosk camera, verifies kiosk authorization status, runs Anti-Spoofing & Face Match
router.post('/recognize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const io = req.app.get('io');
    const imageBuffer = req.file.buffer;

    // Retrieve or register Kiosk ID
    const kioskId = (req.headers['x-kiosk-id'] || req.body.kiosk_id || 'default_kiosk').trim();

    // Check kiosk in DB
    let kioskRes = await query('SELECT * FROM kiosks WHERE kiosk_id = $1', [kioskId]);
    if (kioskRes.rows.length === 0) {
      // Auto register kiosk as PENDING
      kioskRes = await query(
        `INSERT INTO kiosks (kiosk_id, name, status, ip_address, user_agent)
         VALUES ($1, $2, 'PENDING', $3, $4)
         RETURNING *`,
        [kioskId, `Kiosk ${kioskId.slice(-6).toUpperCase()}`, req.ip, req.headers['user-agent'] || '']
      );
      console.log(`[Kiosk] New kiosk discovered and registered as PENDING: ${kioskId}`);
    } else {
      // Update last seen & IP
      await query(
        `UPDATE kiosks SET last_seen = CURRENT_TIMESTAMP, ip_address = $1, user_agent = COALESCE($2, user_agent) WHERE kiosk_id = $3`,
        [req.ip, req.headers['user-agent'] || null, kioskId]
      );
    }

    const currentKiosk = kioskRes.rows[0];
    const isApprovedKiosk = currentKiosk.status === 'APPROVED';

    // 1. Face Detection & Recognition via CompreFace
    const result = await recognizeFaceFromBuffer(imageBuffer, 'frame.jpg');

    if (!result || !result.result || result.result.length === 0) {
      return res.status(200).json({
        success: false,
        kiosk_status: currentKiosk.status,
        is_approved: isApprovedKiosk,
        message: 'Tidak ada wajah terdeteksi',
        total_faces: 0,
        faces: [],
      });
    }

    const detectedFaces = result.result;
    const faceResults = [];

    for (const faceItem of detectedFaces) {
      const box = faceItem.box || {};

      // 2. Anti-Spoofing (Passive Liveness Check)
      const liveness = await checkLiveness(imageBuffer, box);

      if (!liveness.is_real) {
        console.warn(`[Anti-Spoof] Spoof attack blocked on kiosk ${kioskId}! Liveness: ${(liveness.score * 100).toFixed(1)}%`);
        faceResults.push({
          status: 'spoof',
          is_real: false,
          liveness_score: liveness.score,
          box,
          message: 'Peringatan: Spoofing terdeteksi (Layar HP / Foto Cetak)',
        });
        continue;
      }

      // 3. Face Identification Match
      const topSubject = faceItem.subjects && faceItem.subjects.length > 0 ? faceItem.subjects[0] : null;

      if (!topSubject) {
        faceResults.push({
          status: 'unknown',
          is_real: true,
          liveness_score: liveness.score,
          box,
          message: 'Wajah tidak terdaftar dalam sistem',
        });
        continue;
      }

      const similarity = topSubject.similarity || 0;
      const confidence = similarity * 100;
      const subjectName = topSubject.subject;

      // 4. Branch based on Kiosk Approval Status
      if (isApprovedKiosk) {
        // APPROVED KIOSK: Record Attendance
        const attendanceResult = await recordAttendance(subjectName, confidence, kioskId, io, liveness);

        if (attendanceResult.status === 'recorded') {
          faceResults.push({
            status: 'recognized',
            mode: 'ATTENDANCE',
            is_real: true,
            liveness_score: liveness.score,
            user: attendanceResult.user,
            confidence,
            box,
            log: attendanceResult.log,
            message: `Absen berhasil: ${attendanceResult.user.name}`,
          });
        } else if (attendanceResult.status === 'debounced') {
          faceResults.push({
            status: 'debounced',
            mode: 'ATTENDANCE',
            is_real: true,
            liveness_score: liveness.score,
            user: attendanceResult.user,
            confidence,
            remaining_seconds: attendanceResult.remainingSeconds,
            box,
            message: `Sudah absen sebelumnya: ${attendanceResult.user.name}`,
          });
        } else if (attendanceResult.status === 'low_confidence') {
          faceResults.push({
            status: 'low_confidence',
            mode: 'ATTENDANCE',
            is_real: true,
            liveness_score: liveness.score,
            confidence,
            box,
            message: `Tingkat kepercayaan rendah (${confidence.toFixed(1)}% < ${CONFIDENCE_THRESHOLD}%)`,
          });
        } else {
          faceResults.push({
            status: 'unknown',
            mode: 'ATTENDANCE',
            is_real: true,
            liveness_score: liveness.score,
            box,
            message: 'Data pengguna tidak ditemukan di database',
          });
        }
      } else {
        // UNAPPROVED / PENDING KIOSK: Inquiry Mode Only (Check attendance time, DO NOT record)
        const inquiryResult = await inquireAttendance(subjectName, confidence, kioskId, io);

        faceResults.push({
          status: inquiryResult.already_attended ? 'already_attended' : 'not_attended',
          mode: 'INQUIRY',
          kiosk_status: currentKiosk.status,
          is_approved: false,
          is_real: true,
          liveness_score: liveness.score,
          user: inquiryResult.user,
          confidence,
          box,
          already_attended: inquiryResult.already_attended,
          attendance_time: inquiryResult.attendance_time,
          formatted_time: inquiryResult.formatted_time,
          message: inquiryResult.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      kiosk_status: currentKiosk.status,
      is_approved: isApprovedKiosk,
      total_faces: detectedFaces.length,
      faces: faceResults,
    });
  } catch (err) {
    console.error('[Attendance] Recognize error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
