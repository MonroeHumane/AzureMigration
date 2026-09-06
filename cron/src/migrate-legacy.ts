import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { normalizeGender, normalizeAge, rehostPhoto, buildPublicPetUrl } from './sync-pets.js';

/**
 * Migration & Ingestion Pipeline for Monroe County Humane Society PetSync
 * Migrates legacy archived pet records from the Raspberry Pi SQLite database
 * (http://10.0.0.176:8123/?status=Archived) into modern Directus CMS and Azure Blob Storage.
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

function parseLastSeen(raw: string | null): string {
  if (!raw) return new Date().toISOString();
  const normalized = raw.trim().replace(' ', 'T');
  const d = new Date(normalized.includes('+') || normalized.endsWith('Z') ? normalized : normalized + 'Z');
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function resolveSpecies(
  speciesRaw: string | null,
  breed: string | null,
  location: string | null
): { type: string; label: string } {
  const norm = (speciesRaw || '').trim().toLowerCase();
  if (norm.includes('dog') || norm.includes('puppy')) return { type: 'dog', label: 'Dog' };
  if (norm.includes('cat') || norm.includes('kitten')) return { type: 'cat', label: 'Cat' };

  // Heuristic resolution for legacy records where species was left blank
  const breedNorm = (breed || '').toLowerCase();
  const locNorm = (location || '').toLowerCase();
  if (
    breedNorm.includes('dog') ||
    breedNorm.includes('husky') ||
    breedNorm.includes('shepherd') ||
    breedNorm.includes('terrier') ||
    breedNorm.includes('pug') ||
    breedNorm.includes('hound') ||
    breedNorm.includes('retriever') ||
    breedNorm.includes('mix, large') ||
    breedNorm.includes('mix, medium') ||
    breedNorm.includes('mix, small') ||
    locNorm.includes('kennel')
  ) {
    return { type: 'dog', label: 'Dog' };
  }
  if (
    breedNorm.includes('cat') ||
    breedNorm.includes('shorthair') ||
    breedNorm.includes('medium hair') ||
    breedNorm.includes('longhair') ||
    breedNorm.includes('feline') ||
    locNorm.includes('cat')
  ) {
    return { type: 'cat', label: 'Cat' };
  }
  return { type: 'other', label: speciesRaw || 'Other' };
}

function inferSize(breed: string | null): string {
  const b = (breed || '').toLowerCase();
  if (b.includes('large (over 44 lbs')) return 'Large';
  if (b.includes('medium (24-44 lbs')) return 'Medium';
  if (b.includes('small (under 24 lbs')) return 'Small';
  if (b.includes('x-large') || b.includes('xl')) return 'XL';
  return '';
}

async function fetchExistingPetIds(): Promise<Set<string>> {
  const existing = new Set<string>();
  const PAGE_SIZE = 500;
  for (let page = 0; ; page++) {
    const res = await fetch(
      `${DIRECTUS_URL}/items/pets?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&fields=id`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch existing pets from Directus: HTTP ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    const rows = json.data || [];
    for (const r of rows) existing.add(r.id);
    if (rows.length < PAGE_SIZE) break;
  }
  return existing;
}

// Concurrency pool helper for parallel network operations
async function mapConcurrent<T, R>(
  items: T[],
  concurrencyLimit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function migrate() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error(`[Migrate] Export file not found at ${EXPORT_PATH}`);
    process.exit(1);
  }

  const allRows: LegacyRow[] = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  console.log(`[Migrate] Loaded ${allRows.length} total legacy records from ${EXPORT_PATH}`);

  console.log('[Migrate] Querying Directus for existing pet records...');
  const existingIds = await fetchExistingPetIds();
  console.log(`[Migrate] Found ${existingIds.size} existing pets already in Directus.`);

  // Filter for records to insert (archived records from Pi that don't exist yet)
  const toMigrate = allRows.filter((row) => row.id && !existingIds.has(row.id));
  console.log(`[Migrate] Target records to ingest: ${toMigrate.length}`);

  if (toMigrate.length === 0) {
    console.log('[Migrate] No missing records to migrate. Directus is already up to date!');
    return;
  }

  console.log('[Migrate] Stage 1/2: Preparing records & re-hosting photos to Azure Blob Storage...');
  let photoProgress = 0;
  const preparedPets = await mapConcurrent(toMigrate, 12, async (row) => {
    const lastSeenIso = parseLastSeen(row.last_seen);
    const { type, label } = resolveSpecies(row.species, row.breed, row.location);

    let imageUrl = row.photo_url || '';
    if (row.photo_url && !row.photo_url.includes('Photo-Not-Available')) {
      try {
        imageUrl = await rehostPhoto(row.id, row.photo_url);
      } catch (err: any) {
        console.warn(`[Migrate] Photo rehost failed for pet ${row.id}: ${err.message}`);
      }
    }

    photoProgress++;
    if (photoProgress % 50 === 0 || photoProgress === toMigrate.length) {
      console.log(`[Migrate] ...processed ${photoProgress}/${toMigrate.length} photos`);
    }

    return {
      id: row.id,
      name: row.name || 'Friendly Pet',
      type,
      species_label: label,
      breed: row.breed || '',
      age: normalizeAge(row.age || ''),
      age_display: row.age || '',
      size: inferSize(row.breed),
      color: '',
      gender: normalizeGender(row.sexSN || ''),
      location: row.location || '',
      image_url: imageUrl,
      url: row.id ? buildPublicPetUrl(row.id) : '',
      description: row.location || '',
      intake_date: '',
      declawed: '',
      housetrained: '',
      stage: 'Archived',
      first_seen_at: lastSeenIso,
      last_seen_at: lastSeenIso,
      archived_at: lastSeenIso,
    };
  });

  console.log('[Migrate] Stage 2/2: Ingesting prepared records into Directus...');
  const BATCH_SIZE = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < preparedPets.length; i += BATCH_SIZE) {
    const chunk = preparedPets.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`${DIRECTUS_URL}/items/pets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        },
        body: JSON.stringify(chunk),
      });

      if (res.ok) {
        inserted += chunk.length;
        console.log(`[Migrate] Ingested batch ${Math.floor(i / BATCH_SIZE) + 1} (${inserted}/${preparedPets.length} total)`);
      } else {
        console.warn(`[Migrate] Batch POST returned HTTP ${res.status}. Falling back to sequential insert for batch...`);
        // Fallback to per-item insertion if batch rejected
        for (const pet of chunk) {
          const itemRes = await fetch(`${DIRECTUS_URL}/items/pets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            body: JSON.stringify(pet),
          });
          if (itemRes.ok) {
            inserted++;
          } else {
            failed++;
            console.error(`[Migrate] Item insert failed for ${pet.id}: HTTP ${itemRes.status} ${await itemRes.text()}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Migrate] Batch error: ${err.message}. Retrying per item...`);
      for (const pet of chunk) {
        try {
          const itemRes = await fetch(`${DIRECTUS_URL}/items/pets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            body: JSON.stringify(pet),
          });
          if (itemRes.ok) inserted++;
          else failed++;
        } catch (e: any) {
          failed++;
        }
      }
    }
  }

  console.log(`[Migrate] Migration complete! Newly Inserted=${inserted}, Skipped(already existed)=${existingIds.size}, Failed=${failed}`);
}

migrate().catch((err) => {
  console.error('[Migrate] Fatal error:', err);
  process.exit(1);
});
