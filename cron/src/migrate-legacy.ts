import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { normalizeSpecies, normalizeGender, normalizeAge, rehostPhoto } from './sync-pets.js';

/**
 * One-time backfill of PetSync's legacy SQLite data (from the Raspberry Pi,
 * /home/khaose/Downloads/PetSync/pets_enhanced.db) into Directus's `pets`
 * collection. Run once, manually — NOT part of the recurring sync schedule.
 *
 * Expects a JSON export of the SQLite `pets` table at LEGACY_EXPORT_PATH
 * (default: ./legacy-pets-export.json relative to cwd), produced via:
 *   ssh pi "sqlite3 -json /home/khaose/Downloads/PetSync/pets_enhanced.db 'SELECT * FROM pets;'" > legacy-pets-export.json
 */

interface LegacyRow {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  sexSN: string | null;
  age: string | null;
  location: string | null;
  detail_id: string | null;
  photo_url: string | null;
  last_seen: string | null;
  archived: number;
}

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || '';
const EXPORT_PATH = process.env.LEGACY_EXPORT_PATH || path.resolve(process.cwd(), 'legacy-pets-export.json');

async function petExists(id: string): Promise<boolean> {
  const res = await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  return res.ok;
}

async function migrate() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error(`[Migrate] Export file not found at ${EXPORT_PATH}. See header comment for how to produce it.`);
    process.exit(1);
  }

  const rows: LegacyRow[] = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  console.log(`[Migrate] Loaded ${rows.length} legacy records from ${EXPORT_PATH}`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.id) continue;

    if (await petExists(row.id)) {
      skipped++;
      continue;
    }

    const lastSeenIso = row.last_seen ? new Date(row.last_seen.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString();
    const type = normalizeSpecies(row.species || '');
    const imageUrl = await rehostPhoto(row.id, row.photo_url);

    const pet = {
      id: row.id,
      name: row.name || 'Friendly Pet',
      type,
      species_label: row.species || (type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'),
      breed: row.breed || '',
      age: normalizeAge(row.age || ''),
      age_display: row.age || '',
      size: '',
      gender: normalizeGender(row.sexSN || ''),
      location: row.location || '',
      image_url: imageUrl,
      url: '',
      description: row.location || '',
      intake_date: '',
      first_seen_at: lastSeenIso,
      last_seen_at: lastSeenIso,
      archived_at: row.archived === 1 ? lastSeenIso : null,
    };

    const res = await fetch(`${DIRECTUS_URL}/items/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: JSON.stringify(pet),
    });

    if (res.ok) {
      inserted++;
      if (inserted % 50 === 0) console.log(`[Migrate] ...${inserted} inserted so far`);
    } else {
      failed++;
      console.warn(`[Migrate] Failed to insert ${row.id}: HTTP ${res.status} ${await res.text()}`);
    }
  }

  console.log(`[Migrate] Done. Inserted=${inserted} Skipped(already existed)=${skipped} Failed=${failed}`);
}

migrate().catch((err) => {
  console.error('[Migrate] Fatal error:', err);
  process.exit(1);
});
