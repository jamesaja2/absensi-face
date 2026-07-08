const { parse } = require('csv-parse');
const { Readable } = require('stream');
const { getDb } = require('../db');
const { addSubject, trainFaceFromUrl } = require('./compreface');

/**
 * Parse a CSV buffer and return array of { name, nomor_induk, photo_url }
 * Supports headers: Name/name, Nomor Induk/nomor_induk/NomorInduk, Photo URL/photo_url/PhotoURL
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
        const nomor_induk = row.nomor_induk || row.nomorinduk || row.nik || row.id || '';
        const photo_url = row.photo_url || row.photourl || row.foto || row.photo || '';

        if (name && nomor_induk) {
          records.push({ name: name.trim(), nomor_induk: nomor_induk.trim(), photo_url: photo_url.trim() });
        }
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

/**
 * Import users from CSV, register in DB and CompreFace
 * @param {Buffer} csvBuffer - The CSV file buffer
 * @returns {Promise<{ success: number, failed: number, errors: string[], users: object[] }>}
 */
async function importUsersFromCSV(csvBuffer) {
  const records = await parseCSV(csvBuffer);
  const db = getDb();

  const results = {
    success: 0,
    failed: 0,
    errors: [],
    users: [],
  };

  for (const record of records) {
    try {
      const { name, nomor_induk, photo_url } = record;

      // Create subject ID using nomor_induk for uniqueness
      const subjectId = `${nomor_induk}_${name.replace(/\s+/g, '_')}`;

      // Step 1: Upsert user in DB
      const existing = db.prepare('SELECT * FROM users WHERE nomor_induk = ?').get(nomor_induk);

      let userId;
      if (existing) {
        db.prepare(`
          UPDATE users SET name = ?, photo_url = ?, compreface_subject_id = ? WHERE nomor_induk = ?
        `).run(name, photo_url, subjectId, nomor_induk);
        userId = existing.id;
        console.log(`[CSV Import] Updated user: ${name} (${nomor_induk})`);
      } else {
        const result = db.prepare(`
          INSERT INTO users (name, nomor_induk, photo_url, compreface_subject_id)
          VALUES (?, ?, ?, ?)
        `).run(name, nomor_induk, photo_url, subjectId);
        userId = result.lastInsertRowid;
        console.log(`[CSV Import] Created user: ${name} (${nomor_induk})`);
      }

      // Step 2: Register in CompreFace
      await addSubject(subjectId);

      // Step 3: Train face if photo URL is provided
      if (photo_url) {
        try {
          await trainFaceFromUrl(subjectId, photo_url);
        } catch (trainErr) {
          console.warn(`[CSV Import] Face training skipped for ${name}: ${trainErr.message}`);
          results.errors.push(`Face training failed for ${name}: ${trainErr.message}`);
        }
      }

      results.users.push({ id: userId, name, nomor_induk, photo_url, subjectId });
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
