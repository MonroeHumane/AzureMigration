import * as cheerio from 'cheerio';
import { BlobServiceClient } from '@azure/storage-blob';
import 'dotenv/config';

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

const PETANGO_BASE_URL =
  process.env.PETANGO_BASE_URL ||
  'https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals2.aspx';
const PETANGO_AUTHKEY = process.env.PETANGO_AUTHKEY || '';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || '';
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const PHOTO_CONTAINER_NAME = process.env.PET_PHOTO_CONTAINER || 'pet-photos';

export function normalizeSpecies(speciesRaw: string): string {
  const norm = (speciesRaw || '').toLowerCase();
  if (norm.includes('dog') || norm.includes('puppy')) return 'dog';
  if (norm.includes('cat') || norm.includes('kitten')) return 'cat';
  return 'other';
}

export function normalizeGender(genderRaw: string): string {
  const norm = (genderRaw || '').toLowerCase();
  if (norm.startsWith('m') || norm.includes('male') || norm.includes('neutered')) return 'male';
  if (norm.startsWith('f') || norm.includes('female') || norm.includes('spayed')) return 'female';
  return 'unknown';
}

export function normalizeAge(ageRaw: string): string {
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

function buildPetangoUrl(): string {
  return (
    `${PETANGO_BASE_URL}?species=All&gender=A&agegroup=All&location=&site=&onhold=A&orderby=Name` +
    `&colnum=4&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&recAmount=&detailsInPopup=Yes&featuredPet=Include&stageID=`
  );
}

interface RawAnimal {
  petId: string;
  name: string | null;
  speciesRaw: string | null;
  breed: string | null;
  sexSN: string | null;
  ageDisplay: string | null;
  location: string | null;
  detailId: string | null;
  photoUrl: string | null;
}

/**
 * Faithful port of PetSync's fetch_animals() (app.py) — same list-item structure,
 * same species-field fallback (Petango sometimes omits the species class and
 * only exposes a "Species:" label/value pair instead).
 */
function parsePetangoHtml(html: string): RawAnimal[] {
  const $ = cheerio.load(html);
  const animals: RawAnimal[] = [];

  $('div.list-item').each((_, el) => {
    const item = $(el);
    const info = item.find('div.list-animal-info-block').first();
    const photoBlock = item.find('div.list-animal-photo-block').first();

    const pick = (cls: string): string | null => {
      if (!info.length) return null;
      const node = info.find(`div.${cls}`).first();
      if (!node.length) return null;
      const text = node.text().trim();
      return text || null;
    };

    const petId = pick('list-animal-id');
    if (!petId) return;

    let species = pick('list-animal-species');
    if (!species && info.length) {
      const labelNode = info
        .find('*')
        .filter((__, n) => $(n).children().length === 0 && /\bSpecies\s*:/i.test($(n).text()))
        .first();
      if (labelNode.length) {
        const next = labelNode.next();
        if (next.length && next.text().trim()) {
          species = next.text().trim();
        } else {
          const txt = labelNode.text().replace(/\s+/g, ' ').trim();
          species = txt.replace(/(?i:\bSpecies\s*:\s*)/, '').trim() || null;
        }
      }
    }
    if (species === '') species = null;

    let photoUrl: string | null = null;
    if (photoBlock.length) {
      const img = photoBlock.find('img').first();
      const src = img.attr('src');
      if (src) photoUrl = src;
    }

    animals.push({
      petId,
      name: pick('list-animal-name'),
      speciesRaw: species,
      breed: pick('list-animal-breed'),
      sexSN: pick('list-animal-sexSN'),
      ageDisplay: pick('list-animal-age'),
      location: pick('hidden'),
      detailId: pick('list-animal-detail'),
      photoUrl,
    });
  });

  return animals;
}

async function fetchPetangoAnimals(): Promise<RawAnimal[]> {
  if (!PETANGO_AUTHKEY) {
    console.error('[PetSync] PETANGO_AUTHKEY not set; aborting fetch.');
    return [];
  }
  const url = buildPetangoUrl();
  console.log('[PetSync] Fetching pets directly from Petango...');
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Petango fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const animals = parsePetangoHtml(html);
  console.log(`[PetSync] Parsed ${animals.length} animals from Petango.`);
  return animals;
}

let blobServiceClient: BlobServiceClient | null = null;
function getBlobServiceClient(): BlobServiceClient | null {
  if (!STORAGE_CONNECTION_STRING) return null;
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
  }
  return blobServiceClient;
}

/**
 * Downloads a pet's photo from Petango's CDN and re-hosts it in our own Blob
 * Storage so it survives even if Petango's copy disappears once the pet is
 * adopted/archived. Idempotent: skips re-upload if the blob already exists.
 */
export async function rehostPhoto(petId: string, sourceUrl: string | null): Promise<string> {
  const client = getBlobServiceClient();
  if (!client || !sourceUrl) return sourceUrl || '';

  const container = client.getContainerClient(PHOTO_CONTAINER_NAME);
  await container.createIfNotExists({ access: 'blob' });

  const ext = (sourceUrl.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
  const blobName = `${petId}.${ext}`;
  const blockBlobClient = container.getBlockBlobClient(blobName);

  const alreadyExists = await blockBlobClient.exists();
  if (alreadyExists) {
    return blockBlobClient.url;
  }

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[PetSync] Photo fetch failed for ${petId}: HTTP ${res.status}`);
      return sourceUrl;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    await blockBlobClient.uploadData(buf, { blobHTTPHeaders: { blobContentType: contentType } });
    return blockBlobClient.url;
  } catch (err: any) {
    console.warn(`[PetSync] Photo re-host failed for ${petId}: ${err.message}`);
    return sourceUrl;
  }
}

async function writeSyncRun(status: 'success' | 'error', stats: { active: number; inserted: number; archived: number }, errorMessage?: string) {
  try {
    await fetch(`${DIRECTUS_URL}/items/sync_runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        status,
        active_count: stats.active,
        inserted_count: stats.inserted,
        archived_count: stats.archived,
        error_message: errorMessage || null,
      }),
    });
  } catch (err: any) {
    console.warn(`[PetSync] Failed to write sync_runs entry: ${err.message}`);
  }
}

export async function runPetSync(): Promise<{ active: number; archived: number; inserted: number }> {
  console.log(`[PetSync] Starting sync at ${new Date().toISOString()}`);
  const nowIso = new Date().toISOString();

  let raw: RawAnimal[];
  try {
    raw = await fetchPetangoAnimals();
  } catch (err: any) {
    console.error(`[PetSync] Petango fetch failed: ${err.message}`);
    await writeSyncRun('error', { active: 0, inserted: 0, archived: 0 }, err.message);
    return { active: 0, inserted: 0, archived: 0 };
  }

  if (raw.length === 0) {
    console.warn('[PetSync] No animals parsed; aborting sync to avoid mass-archiving on a bad fetch.');
    await writeSyncRun('error', { active: 0, inserted: 0, archived: 0 }, 'Zero animals parsed from Petango response');
    return { active: 0, inserted: 0, archived: 0 };
  }

  const activePets: PetRecord[] = [];
  for (const a of raw) {
    const imageUrl = await rehostPhoto(a.petId, a.photoUrl);
    const type = normalizeSpecies(a.speciesRaw || '');
    activePets.push({
      id: a.petId,
      name: a.name || 'Friendly Pet',
      type,
      species_label: a.speciesRaw || (type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'),
      breed: a.breed || '',
      age: normalizeAge(a.ageDisplay || ''),
      age_display: a.ageDisplay || '',
      size: '',
      gender: normalizeGender(a.sexSN || ''),
      location: a.location || '',
      image_url: imageUrl,
      url: a.detailId
        ? `https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx?id=${encodeURIComponent(a.petId)}&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&PopUp=true`
        : '',
      description: a.location || '',
      intake_date: '',
      last_seen_at: nowIso,
      archived_at: null,
    });
  }

  try {
    const existingRes = await fetch(`${DIRECTUS_URL}/items/pets?limit=-1&fields=id,archived_at`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });

    if (!existingRes.ok) {
      throw new Error(`Directus fetch failed: HTTP ${existingRes.status}`);
    }

    const existingData = await existingRes.json();
    const existingPets: Array<{ id: string; archived_at: string | null }> = existingData.data || [];
    const existingMap = new Map(existingPets.map((p) => [p.id, p]));
    const activeIds = new Set(activePets.map((p) => p.id));

    let inserted = 0;
    let archived = 0;

    for (const pet of activePets) {
      const existing = existingMap.get(pet.id);
      if (!existing) {
        pet.first_seen_at = nowIso;
        await fetch(`${DIRECTUS_URL}/items/pets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify(pet),
        });
        inserted++;
      } else {
        await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(pet.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify({ ...pet, archived_at: null }),
        });
      }
    }

    for (const [id, record] of existingMap.entries()) {
      if (!activeIds.has(id) && !record.archived_at) {
        await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify({ archived_at: nowIso }),
        });
        archived++;
      }
    }

    console.log(`[PetSync] Sync complete: ${activePets.length} active, ${inserted} new, ${archived} archived.`);
    await writeSyncRun('success', { active: activePets.length, inserted, archived });
    return { active: activePets.length, inserted, archived };
  } catch (err: any) {
    console.error(`[PetSync] Directus sync failed: ${err.message}`);
    await writeSyncRun('error', { active: activePets.length, inserted: 0, archived: 0 }, err.message);
    return { active: activePets.length, inserted: 0, archived: 0 };
  }
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
