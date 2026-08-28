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
  color: string;
  gender: string;
  location: string;
  image_url: string;
  url: string;
  description: string;
  intake_date: string;
  declawed: string;
  housetrained: string;
  stage: string;
  first_seen_at?: string;
  last_seen_at: string;
  archived_at?: string | null;
}

const PETANGO_BASE_URL =
  process.env.PETANGO_BASE_URL ||
  'https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals2.aspx';
const PETANGO_DETAIL_BASE_URL =
  process.env.PETANGO_DETAIL_BASE_URL ||
  'https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx';
const PETANGO_AUTHKEY = process.env.PETANGO_AUTHKEY || '';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || '';
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const PHOTO_CONTAINER_NAME = process.env.PET_PHOTO_CONTAINER || 'pet-photos';
const GITHUB_DISPATCH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'MonroeHumane/AzureMigration';

export function normalizeSpecies(speciesRaw: string): string {
  const norm = (speciesRaw || '').toLowerCase();
  if (norm.includes('dog') || norm.includes('puppy')) return 'dog';
  if (norm.includes('cat') || norm.includes('kitten')) return 'cat';
  return 'other';
}

export function normalizeGender(genderRaw: string): string {
  const norm = (genderRaw || '').toLowerCase();
  // Check "female" before "male" — "female" contains "male" as a substring,
  // so checking male first misclassified every female animal (real bug,
  // found by auditing live data: 88/88 synced pets showed as "male").
  if (norm.includes('female') || norm.includes('spayed')) return 'female';
  if (norm.includes('male') || norm.includes('neutered')) return 'male';
  return 'unknown';
}

export function normalizeAge(ageRaw: string): string {
  const norm = (ageRaw || '').toLowerCase();
  if (norm.includes('puppy') || norm.includes('kitten') || norm.includes('baby')) {
    return 'baby';
  }
  // Parse the actual year count so "1 year 2 months" buckets correctly.
  // The previous version checked includes('month') first, which matched
  // the trailing "months" in any "X years Y months" age and misclassified
  // it as a baby regardless of the year count (real bug, found by auditing
  // live data — e.g. real values like "1 year 2 months" existed in the set).
  const yearMatch = norm.match(/(\d+)\s*year/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    if (years >= 8) return 'senior';
    if (years <= 2) return 'young';
    return 'adult';
  }
  if (norm.includes('senior')) return 'senior';
  if (norm.includes('young')) return 'young';
  // No "year" mention at all (e.g. "3 weeks", "2 months") means under 1 year.
  if (norm.includes('month') || norm.includes('week') || norm.includes('day')) return 'baby';
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
          species = txt.replace(/\bSpecies\s*:\s*/i, '').trim() || null;
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

interface AnimalDetail {
  size: string;
  color: string;
  intakeDate: string;
  declawed: string;
  housetrained: string;
  stage: string;
}

const EMPTY_DETAIL: AnimalDetail = { size: '', color: '', intakeDate: '', declawed: '', housetrained: '', stage: '' };

/**
 * The list endpoint (fetchPetangoAnimals) only exposes id/name/species/breed/
 * age/sex/location/photo. Size, color, intake date, declawed, housetrained,
 * and stage are only available on the per-animal detail page — fetched here
 * so the sync actually captures everything Petango offers for each animal.
 */
async function fetchAnimalDetail(petId: string): Promise<AnimalDetail> {
  const url = `${PETANGO_DETAIL_BASE_URL}?id=${encodeURIComponent(petId)}&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&PopUp=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return EMPTY_DETAIL;
    const html = await res.text();
    const $ = cheerio.load(html);
    const pairs: Record<string, string> = {};
    $('.detail-label').each((_, el) => {
      const label = $(el).text().trim();
      const value = $(el).next('.detail-value').text().trim();
      if (label) pairs[label] = value;
    });
    let intakeDate = '';
    if (pairs['Intake Date']) {
      const parsed = new Date(pairs['Intake Date']);
      if (!isNaN(parsed.getTime())) intakeDate = parsed.toISOString();
    }
    return {
      size: pairs['Size'] || '',
      color: pairs['Color'] || '',
      intakeDate,
      declawed: pairs['Declawed'] || '',
      housetrained: pairs['Housetrained'] || '',
      stage: pairs['Stage'] || '',
    };
  } catch (err: any) {
    console.warn(`[PetSync] Detail fetch failed for ${petId}: ${err.message}`);
    return EMPTY_DETAIL;
  }
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

/**
 * The frontend is a static build (Astro `output: 'static'`) — it only shows
 * fresh pet data after a rebuild, which otherwise only happens when someone
 * pushes a frontend change. deploy-frontend.yml already listens for a
 * `cms_rebuild` repository_dispatch event; this just actually calls it,
 * and only when something real changed, so an unchanged 30-min tick doesn't
 * trigger a pointless rebuild.
 */
async function triggerFrontendRebuild(): Promise<void> {
  if (!GITHUB_DISPATCH_TOKEN) {
    console.log('[PetSync] GITHUB_DISPATCH_TOKEN not set; skipping frontend rebuild trigger.');
    return;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'cms_rebuild' }),
    });
    if (res.status === 204) {
      console.log('[PetSync] Triggered frontend rebuild (cms_rebuild dispatch).');
    } else {
      console.warn(`[PetSync] Frontend rebuild dispatch failed: HTTP ${res.status} ${await res.text()}`);
    }
  } catch (err: any) {
    console.warn(`[PetSync] Frontend rebuild dispatch error: ${err.message}`);
  }
}

export async function runPetSync(): Promise<{ active: number; archived: number; inserted: number; ok: boolean }> {
  console.log(`[PetSync] Starting sync at ${new Date().toISOString()}`);
  const nowIso = new Date().toISOString();

  let raw: RawAnimal[];
  try {
    raw = await fetchPetangoAnimals();
  } catch (err: any) {
    console.error(`[PetSync] Petango fetch failed: ${err.message}`);
    await writeSyncRun('error', { active: 0, inserted: 0, archived: 0 }, err.message);
    return { active: 0, inserted: 0, archived: 0, ok: false };
  }

  if (raw.length === 0) {
    console.warn('[PetSync] No animals parsed; aborting sync to avoid mass-archiving on a bad fetch.');
    await writeSyncRun('error', { active: 0, inserted: 0, archived: 0 }, 'Zero animals parsed from Petango response');
    return { active: 0, inserted: 0, archived: 0, ok: false };
  }

  const activePets: PetRecord[] = [];
  for (const a of raw) {
    const [imageUrl, detail] = await Promise.all([
      rehostPhoto(a.petId, a.photoUrl),
      fetchAnimalDetail(a.petId),
    ]);
    const type = normalizeSpecies(a.speciesRaw || '');
    activePets.push({
      id: a.petId,
      name: a.name || 'Friendly Pet',
      type,
      species_label: a.speciesRaw || (type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'),
      breed: a.breed || '',
      age: normalizeAge(a.ageDisplay || ''),
      age_display: a.ageDisplay || '',
      size: detail.size,
      color: detail.color,
      gender: normalizeGender(a.sexSN || ''),
      location: a.location || '',
      image_url: imageUrl,
      url: a.detailId
        ? `https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx?id=${encodeURIComponent(a.petId)}&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&PopUp=true`
        : '',
      description: a.location || '',
      intake_date: detail.intakeDate,
      declawed: detail.declawed,
      housetrained: detail.housetrained,
      stage: detail.stage,
      last_seen_at: nowIso,
      archived_at: null,
    });
  }

  try {
    // Paginated fetch, not `limit=-1`. Directus's "unlimited" behavior for
    // limit=-1 depends on its QUERY_LIMIT_MAX config, which is not something
    // this job controls or can assume — if it were ever capped, a silent
    // partial result here would make currently-active pets look "missing"
    // and get wrongly archived. Paginating removes that dependency entirely.
    const existingPets: Array<{ id: string; archived_at: string | null }> = [];
    const PAGE_SIZE = 500;
    for (let page = 0; ; page++) {
      const pageRes = await fetch(
        `${DIRECTUS_URL}/items/pets?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&fields=id,archived_at&sort=id`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } }
      );
      if (!pageRes.ok) {
        throw new Error(`Directus fetch failed: HTTP ${pageRes.status} (page ${page})`);
      }
      const pageData = await pageRes.json();
      const rows: Array<{ id: string; archived_at: string | null }> = pageData.data || [];
      existingPets.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }

    const existingMap = new Map(existingPets.map((p) => [p.id, p]));
    const activeIds = new Set(activePets.map((p) => p.id));

    // Sanity guard: if Petango's response was truncated or partially broken
    // (rather than genuinely empty, which is already caught above), a small
    // active count relative to what's currently marked non-archived would
    // otherwise mass-archive pets that are still actually available. Refuse
    // to archive anything in that case rather than trust a suspicious result.
    const previouslyActiveCount = existingPets.filter((p) => !p.archived_at).length;
    const SANITY_MIN_SAMPLE = 5;
    const SANITY_DROP_RATIO = 0.5;
    const suspiciousDropoff =
      previouslyActiveCount >= SANITY_MIN_SAMPLE && activePets.length < previouslyActiveCount * SANITY_DROP_RATIO;
    if (suspiciousDropoff) {
      const msg = `Refusing to archive: Petango returned ${activePets.length} active animals vs ${previouslyActiveCount} previously active (>50% drop). Likely a partial/bad fetch, not real turnover.`;
      console.error(`[PetSync] ${msg}`);
      await writeSyncRun('error', { active: activePets.length, inserted: 0, archived: 0 }, msg);
      return { active: activePets.length, inserted: 0, archived: 0, ok: false };
    }

    let inserted = 0;
    let archived = 0;
    let writeFailures = 0;

    for (const pet of activePets) {
      const existing = existingMap.get(pet.id);
      if (!existing) {
        pet.first_seen_at = nowIso;
        const res = await fetch(`${DIRECTUS_URL}/items/pets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify(pet),
        });
        if (res.ok) {
          inserted++;
        } else {
          writeFailures++;
          console.error(`[PetSync] Insert failed for ${pet.id} (${res.status}): ${await res.text()}`);
        }
      } else {
        const res = await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(pet.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify({ ...pet, archived_at: null }),
        });
        if (!res.ok) {
          writeFailures++;
          console.error(`[PetSync] Update failed for ${pet.id} (${res.status}): ${await res.text()}`);
        }
      }
    }

    for (const [id, record] of existingMap.entries()) {
      if (!activeIds.has(id) && !record.archived_at) {
        const res = await fetch(`${DIRECTUS_URL}/items/pets/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          body: JSON.stringify({ archived_at: nowIso }),
        });
        if (res.ok) {
          archived++;
        } else {
          writeFailures++;
          console.error(`[PetSync] Archive failed for ${id} (${res.status}): ${await res.text()}`);
        }
      }
    }

    const status = writeFailures > 0 ? 'error' : 'success';
    const errorMessage = writeFailures > 0 ? `${writeFailures} write(s) failed — see job logs` : undefined;
    console.log(`[PetSync] Sync complete: ${activePets.length} active, ${inserted} new, ${archived} archived, ${writeFailures} write failures.`);
    await writeSyncRun(status, { active: activePets.length, inserted, archived }, errorMessage);
    if (writeFailures === 0 && (inserted > 0 || archived > 0)) {
      await triggerFrontendRebuild();
    }
    return { active: activePets.length, inserted, archived, ok: writeFailures === 0 };
  } catch (err: any) {
    console.error(`[PetSync] Directus sync failed: ${err.message}`);
    await writeSyncRun('error', { active: activePets.length, inserted: 0, archived: 0 }, err.message);
    return { active: activePets.length, inserted: 0, archived: 0, ok: false };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPetSync()
    .then((stats) => {
      if (stats.ok) {
        console.log('[PetSync] Execution finished successfully', stats);
        process.exit(0);
      } else {
        // Non-zero exit so the job execution itself shows Failed in Azure —
        // sync_runs already has the detail, but the platform-level status
        // needs to reflect reality too so monitoring/alerting isn't blind
        // to a sync that silently degraded.
        console.error('[PetSync] Execution completed with errors', stats);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[PetSync] Execution failed', err);
      process.exit(1);
    });
}
