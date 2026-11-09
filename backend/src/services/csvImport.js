const { parse } = require('csv-parse');
const { Readable } = require('stream');
const { query } = require('../db');
const { addSubject, trainFaceFromUrl } = require('./compreface');

/**
 * Parse a CSV buffer and return array of { name, nomor_induk, email, photo_url }
 */
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const records = [];

    const stream = Readable.from(buffer.toString());
    stream
      .pipe(
        parse({
          columns: (header) =>
            header.map((h) =>
              h.trim().toLowerCase().replace(/[\s_]+/g, '_')
            ),
          skip_empty_lines: true,
          trim: true,
        })
      )
      .on('data', (row) => {
        // Normalize column names
        const name = row.name || row.nama || '';
        const nomor_induk = row.nomor_induk || row.nomorinduk || row.nik || row.nis || row.id || '';
        const email = row.email || '';
        const photo_url = row.photo_url || row.photourl || row.foto || row.photo || '';

        if (name && nomor_induk) {
          records.push({
            name: name.trim(),
            nomor_induk: nomor_induk.trim(),
            email: email.trim(),
            photo_url: photo_url.trim(),
          });
        }
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

/**
 * Import users from CSV, register in DB and CompreFace
 */
async function importUsersFromCSV(csvBuffer) {
  const records = await parseCSV(csvBuffer);

  const results = {
    success: 0,
    failed: 0,
    errors: [],
    users: [],
  };

  for (const record of records) {
    try {
      const { name, nomor_induk, email, photo_url } = record;
      const cleanSubjectName = name.replace(/[^a-zA-Z0-9]/g, '_');
      const subjectId = `${nomor_induk}_${cleanSubjectName}`;

      // Upsert user in PostgreSQL
      const upsertRes = await query(
        `INSERT INTO users (name, nomor_induk, email, photo_url, compreface_subject_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (nomor_induk) DO UPDATE SET
           name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, users.email),
           photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
           compreface_subject_id = EXCLUDED.compreface_subject_id
         RETURNING id`,
        [name, nomor_induk, email || null, photo_url || null, subjectId]
      );
      const userId = upsertRes.rows[0].id;

      // Register in CompreFace
      await addSubject(subjectId);

      // Train face if photo URL is provided
      if (photo_url) {
        try {
          await trainFaceFromUrl(subjectId, photo_url);
        } catch (trainErr) {
          console.warn(`[CSV Import] Face training skipped for ${name}: ${trainErr.message}`);
          results.errors.push(`Face training failed for ${name}: ${trainErr.message}`);
        }
      }

      results.users.push({ id: userId, name, nomor_induk, email, photo_url, subjectId });
      results.success++;
    } catch (err) {
      console.error(`[CSV Import] Failed for ${record.name}:`, err.message);
      results.errors.push(`${record.name} (${record.nomor_induk}): ${err.message}`);
      results.failed++;
    }
  }

  console.log(`[CSV Import] Done. Success: ${results.success}, Failed: ${results.failed}`);
  return results;
}

module.exports = { importUsersFromCSV, parseCSV };
