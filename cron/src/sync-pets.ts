import { parse } from 'csv-parse/sync';
import 'dotenv/config';

interface RawPetRow {
  [key: string]: string;
}

interface PetRecord {
  id: string;
  name: string;
  type: string;
  species_label: string;
  breed: string;
  age: string;
  age_display: string;
  size: string;
  gender: string;
  location: string;
  image_url: string;
  url: string;
  description: string;
  intake_date: string;
  first_seen_at?: string;
  last_seen_at: string;
  archived_at?: string | null;
}

const GOOGLE_SHEET_CSV_URL =
  process.env.GOOGLE_SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeJ5vC9u2A_example/pub?output=csv';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || 'admin-static-token';

function normalizeSpecies(speciesRaw: string): string {
  const norm = (speciesRaw || '').toLowerCase();
  if (norm.includes('dog') || norm.includes('puppy')) return 'dog';
  if (norm.includes('cat') || norm.includes('kitten')) return 'cat';
  return 'other';
}

function normalizeGender(genderRaw: string): string {
  const norm = (genderRaw || '').toLowerCase();
  if (norm.startsWith('m') || norm.includes('male') || norm.includes('neutered')) return 'male';
  if (norm.startsWith('f') || norm.includes('female') || norm.includes('spayed')) return 'female';
  return 'unknown';
}

function normalizeAge(ageRaw: string): string {
  const norm = (ageRaw || '').toLowerCase();
  if (norm.includes('month') || norm.includes('puppy') || norm.includes('kitten') || norm.includes('baby')) {
    return 'baby';
  }
  if (norm.includes('1 year') || norm.includes('2 year') || norm.includes('young')) {
    return 'young';
  }
  if (norm.includes('senior') || norm.includes('8 year') || norm.includes('9 year') || norm.includes('10 year')) {
    return 'senior';
  }
  return 'adult';
}

function getCell(row: RawPetRow, keys: string[]): string {
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.trim().toLowerCase() === k.toLowerCase() && row[rowKey]) {
        return row[rowKey].trim();
      }
    }
  }
  return '';
}

export async function runPetSync(): Promise<{ active: number; archived: number; inserted: number }> {
  console.log(`[PetSync] Starting sync at ${new Date().toISOString()}`);
  console.log(`[PetSync] Fetching Google Sheet CSV from: ${GOOGLE_SHEET_CSV_URL}`);

  let csvText = '';
  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 MonroeHumane-PetSync/2.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    csvText = await res.text();
  } catch (err: any) {
    console.warn(`[PetSync] Could not fetch Google Sheet CSV: ${err.message}. Using offline fallback.`);
    return { active: 0, archived: 0, inserted: 0 };
  }

  // Strip BOM
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.substring(1);
  }

  const rawRows: RawPetRow[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[PetSync] Parsed ${rawRows.length} rows from CSV`);

  const activePets: PetRecord[] = [];
  const nowIso = new Date().toISOString();

  for (const row of rawRows) {
    const archived = getCell(row, ['Archived', 'archive']).toLowerCase();
    if (archived === 'yes' || archived === 'true') {
      continue;
    }

    const id = getCell(row, ['ID', 'pet_id', 'Animal ID']);
    if (!id) continue;

    const name = getCell(row, ['Name', 'Pet Name']) || 'Friendly Pet';
    const speciesRaw = getCell(row, ['Species', 'Type', 'Animal Type']);
    const type = normalizeSpecies(speciesRaw);
    const breed = getCell(row, ['Breed', 'Primary Breed']);
    const ageDisplay = getCell(row, ['Age', 'Age String']);
    const age = normalizeAge(ageDisplay);
    const gender = normalizeGender(getCell(row, ['Sex/SN', 'Sex', 'Gender']));
    const size = getCell(row, ['Size', 'Weight', 'Size category']);
    const location = getCell(row, ['Location', 'Kennel', 'Room']);
    const imageUrl = getCell(row, ['Photo URL', 'Photo', 'Image', 'Image URL']);
    const description = getCell(row, ['Description', 'Bio', 'Notes']) || location;
    const intakeDate = getCell(row, ['Intake Date', 'Intake', 'Date', 'Posted']);

    const petangoAuthKey = process.env.PETANGO_AUTHKEY || '';
    const petangoUrl = `https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx?id=${encodeURIComponent(
      id
    )}&css=&authkey=${petangoAuthKey}&PopUp=true`;

    activePets.push({
      id,
      name,
      type,
      species_label: speciesRaw || (type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'),
      breed,
      age,
      age_display: ageDisplay,
      size,
      gender,
      location,
      image_url: imageUrl,
      url: petangoUrl,
      description,
      intake_date: intakeDate,
      last_seen_at: nowIso,
      archived_at: null,
    });
  }

  console.log(`[PetSync] Found ${activePets.length} active non-archived pets`);

  // Directus Integration
  try {
    const existingRes = await fetch(`${DIRECTUS_URL}/items/pets?limit=-1&fields=id,archived_at`, {
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
    });

    if (existingRes.ok) {
      const existingData = await existingRes.json();
      const existingPets: Array<{ id: string; archived_at: string | null }> = existingData.data || [];
      const existingMap = new Map(existingPets.map((p) => [p.id, p]));
      const activeIds = new Set(activePets.map((p) => p.id));

      let inserted = 0;
      let archived = 0;

      // Upsert active pets
      for (const pet of activePets) {
        const existing = existingMap.get(pet.id);
        if (!existing) {
          pet.first_seen_at = nowIso;
          await fetch(`${DIRECTUS_URL}/items/pets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            body: JSON.stringify(pet),
          });
          inserted++;
        } else {
          await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(pet.id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            body: JSON.stringify(pet),
          });
        }
      }

      // Archive missing pets
      for (const [id, record] of existingMap.entries()) {
        if (!activeIds.has(id) && !record.archived_at) {
          await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            body: JSON.stringify({ archived_at: nowIso }),
          });
          archived++;
        }
      }

      console.log(`[PetSync] Sync Complete: ${activePets.length} active, ${inserted} new, ${archived} archived.`);
      return { active: activePets.length, inserted, archived };
    }
  } catch (err: any) {
    console.warn(`[PetSync] Directus API unreachable (${err.message}). Ingestion will retry on next schedule.`);
  }

  return { active: activePets.length, inserted: 0, archived: 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPetSync()
    .then((stats) => {
      console.log('[PetSync] Execution finished successfully', stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[PetSync] Execution failed', err);
      process.exit(1);
    });
}
