import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  first_seen_at: string;
  last_seen_at: string;
  archived_at: string | null;
  color: string;
  declawed: string;
  housetrained: string;
  stage: string;
}

const PETANGO_BASE_URL =
  process.env.PETANGO_BASE_URL ||
  'https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals2.aspx';
const PETANGO_DETAIL_BASE_URL =
  process.env.PETANGO_DETAIL_BASE_URL ||
  'https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimalDetails2.aspx';
const PETANGO_AUTHKEY = process.env.PETANGO_AUTHKEY || '';
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://monroe-humane.org').replace(/\/+$/, '');

// Path to frontend data files relative to cron/src
const SHELTER_PETS_PATH = path.resolve(__dirname, '../../frontend/src/data/shelter-pets.json');
const PUBLIC_SHELTER_PETS_PATH = path.resolve(__dirname, '../../frontend/public/shelter-pets.json');
const ARCHIVED_PETS_PATH = path.resolve(__dirname, '../../frontend/src/data/archived-pets.json');

export function normalizeSpecies(speciesRaw: string): string {
  const norm = (speciesRaw || '').toLowerCase();
  if (norm.includes('dog') || norm.includes('puppy')) return 'dog';
  if (norm.includes('cat') || norm.includes('kitten')) return 'cat';
  return 'other';
}

export function normalizeGender(genderRaw: string): string {
  const norm = (genderRaw || '').toLowerCase();
  if (norm.includes('female') || norm.includes('spayed')) return 'female';
  if (norm.includes('male') || norm.includes('neutered')) return 'male';
  return 'unknown';
}

export function normalizeAge(ageRaw: string): string {
  const norm = (ageRaw || '').toLowerCase();
  if (norm.includes('puppy') || norm.includes('kitten') || norm.includes('baby')) {
    return 'baby';
  }
  const yearMatch = norm.match(/(\d+)\s*year/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    if (years >= 8) return 'senior';
    if (years <= 2) return 'young';
    return 'adult';
  }
  if (norm.includes('senior')) return 'senior';
  if (norm.includes('young')) return 'young';
  if (norm.includes('month') || norm.includes('week') || norm.includes('day')) return 'baby';
  return 'adult';
}

function buildPetangoUrl(): string {
  return (
    `${PETANGO_BASE_URL}?species=All&gender=A&agegroup=All&location=&site=&onhold=A&orderby=Name` +
    `&colnum=4&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&recAmount=&detailsInPopup=Yes&featuredPet=Include&stageID=`
  );
}

function buildPetangoDetailUrl(petId: string): string {
  return `${PETANGO_DETAIL_BASE_URL}?id=${encodeURIComponent(petId)}&css=&authkey=${encodeURIComponent(PETANGO_AUTHKEY)}&PopUp=true`;
}

interface RawAnimal {
  petId: string;
  name: string | null;
  speciesRaw: string | null;
  breed: string | null;
  sexSN: string | null;
  ageDisplay: string | null;
  location: string | null;
  photoUrl: string | null;
}

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
      photoUrl,
    });
  });

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

async function fetchAnimalDetail(petId: string): Promise<AnimalDetail> {
  const url = buildPetangoDetailUrl(petId);
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

export async function runSyncToJson(): Promise<{
  active: number;
  newCount: number;
  archived: number;
  ok: boolean;
}> {
  console.log(`[PetSync] Starting static JSON sync at ${new Date().toISOString()}`);

  if (!PETANGO_AUTHKEY) {
    console.error('[PetSync] Error: PETANGO_AUTHKEY is not set. Cannot fetch from Petango.');
    return { active: 0, newCount: 0, archived: 0, ok: false };
  }

  // Load existing files
  let existingActive: PetRecord[] = [];
  let existingArchived: PetRecord[] = [];
  try {
    if (fs.existsSync(SHELTER_PETS_PATH)) {
      existingActive = JSON.parse(fs.readFileSync(SHELTER_PETS_PATH, 'utf-8'));
    }
  } catch (e: any) {
    console.warn(`[PetSync] Could not read ${SHELTER_PETS_PATH}: ${e.message}`);
  }

  try {
    if (fs.existsSync(ARCHIVED_PETS_PATH)) {
      existingArchived = JSON.parse(fs.readFileSync(ARCHIVED_PETS_PATH, 'utf-8'));
    }
  } catch (e: any) {
    console.warn(`[PetSync] Could not read ${ARCHIVED_PETS_PATH}: ${e.message}`);
  }

  const existingMap = new Map<string, PetRecord>();
  existingActive.forEach((p) => existingMap.set(p.id, p));

  // Fetch raw animals from Petango
  console.log('[PetSync] Fetching adoptable pets from Petango...');
  const res = await fetch(buildPetangoUrl(), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Petango fetch failed: HTTP ${res.status}`);
  }
  const rawAnimals = parsePetangoHtml(await res.text());
  console.log(`[PetSync] Parsed ${rawAnimals.length} animals from Petango.`);

  if (rawAnimals.length === 0) {
    console.warn('[PetSync] 0 animals parsed; aborting sync to avoid mass-archiving on an empty fetch.');
    return { active: existingActive.length, newCount: 0, archived: 0, ok: false };
  }

  // Sanity check drop ratio
  const SANITY_MIN_SAMPLE = 5;
  const SANITY_DROP_RATIO = 0.5;
  if (existingActive.length >= SANITY_MIN_SAMPLE && rawAnimals.length < existingActive.length * SANITY_DROP_RATIO) {
    console.error(
      `[PetSync] Refusing to archive: Petango returned ${rawAnimals.length} active animals vs ${existingActive.length} previously active (>50% drop).`
    );
    return { active: existingActive.length, newCount: 0, archived: 0, ok: false };
  }

  const nowIso = new Date().toISOString();
  const updatedActive: PetRecord[] = [];
  const currentPetIds = new Set<string>();
  let newCount = 0;

  // Process each animal
  for (const a of rawAnimals) {
    currentPetIds.add(a.petId);
    const existing = existingMap.get(a.petId);
    const detail = await fetchAnimalDetail(a.petId);
    const type = normalizeSpecies(a.speciesRaw || '');

    const firstSeen = existing?.first_seen_at || nowIso;
    if (!existing) newCount++;

    const pet: PetRecord = {
      id: a.petId,
      name: a.name || 'Friendly Pet',
      type,
      species_label: a.speciesRaw || (type === 'dog' ? 'Dog' : type === 'cat' ? 'Cat' : 'Other'),
      breed: a.breed || '',
      age: normalizeAge(a.ageDisplay || ''),
      age_display: a.ageDisplay || '',
      size: detail.size || existing?.size || '',
      color: detail.color || existing?.color || '',
      gender: normalizeGender(a.sexSN || ''),
      location: a.location || existing?.location || '',
      image_url: a.photoUrl || existing?.image_url || '/assets/recovered/images/placeholder.svg',
      url: `${PUBLIC_SITE_URL}/adopt/${encodeURIComponent(a.petId)}`,
      description: a.location || existing?.description || '',
      intake_date: detail.intakeDate || existing?.intake_date || '',
      declawed: detail.declawed || existing?.declawed || 'No',
      housetrained: detail.housetrained || existing?.housetrained || 'Unknown',
      stage: detail.stage || existing?.stage || 'Available',
      first_seen_at: firstSeen,
      last_seen_at: nowIso,
      archived_at: null,
    };

    updatedActive.push(pet);
  }

  // Find newly archived pets (were active before, not in current fetch)
  const newlyArchived: PetRecord[] = [];
  for (const prev of existingActive) {
    if (!currentPetIds.has(prev.id)) {
      newlyArchived.push({
        ...prev,
        archived_at: nowIso,
      });
    }
  }

  // Combine archived pets without duplicates
  const archivedMap = new Map<string, PetRecord>();
  existingArchived.forEach((p) => archivedMap.set(p.id, p));
  newlyArchived.forEach((p) => archivedMap.set(p.id, p));
  const updatedArchived = Array.from(archivedMap.values());

  // Save files
  fs.writeFileSync(SHELTER_PETS_PATH, JSON.stringify(updatedActive, null, 2), 'utf-8');
  fs.writeFileSync(PUBLIC_SHELTER_PETS_PATH, JSON.stringify(updatedActive, null, 2), 'utf-8');
  fs.writeFileSync(ARCHIVED_PETS_PATH, JSON.stringify(updatedArchived, null, 2), 'utf-8');

  console.log(
    `[PetSync] Success: ${updatedActive.length} active pets (${newCount} new), ${newlyArchived.length} newly archived (total archived: ${updatedArchived.length}).`
  );

  return {
    active: updatedActive.length,
    newCount,
    archived: newlyArchived.length,
    ok: true,
  };
}

// Run when called directly
if (process.argv[1] && process.argv[1].endsWith('sync-to-json.ts')) {
  runSyncToJson()
    .then((res) => {
      if (!res.ok) process.exit(1);
    })
    .catch((err) => {
      console.error('[PetSync] Fatal error:', err);
      process.exit(1);
    });
}
