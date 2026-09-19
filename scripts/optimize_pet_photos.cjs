/**
 * scripts/optimize_pet_photos.cjs
 *
 * Automated WebP/AVIF Transcoding Pipeline for Monroe County Humane Society.
 * Downloads remote pet photos from Petango, converts to high-density WebP
 * (card + thumbnail sizes), and updates shelter-pets.json with local URLs.
 */

const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require(path.resolve(__dirname, '../frontend/node_modules/sharp'));
} catch {
  sharp = require('sharp');
}

const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const PUBLIC_PETS_DIR = path.resolve(FRONTEND_DIR, 'public/pets');
const SRC_PETS_JSON = path.resolve(FRONTEND_DIR, 'src/data/shelter-pets.json');
const PUBLIC_PETS_JSON = path.resolve(FRONTEND_DIR, 'public/shelter-pets.json');

const CONCURRENCY = 5;

// Ensure output directory exists
if (!fs.existsSync(PUBLIC_PETS_DIR)) {
  fs.mkdirSync(PUBLIC_PETS_DIR, { recursive: true });
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function processPet(pet, index, total) {
  const id = pet.id;
  const webpCardPath = path.resolve(PUBLIC_PETS_DIR, `pet_${id}.webp`);
  const webpThumbPath = path.resolve(PUBLIC_PETS_DIR, `pet_${id}_thumb.webp`);

  const cardWebpUrl = `/pets/pet_${id}.webp`;
  const thumbWebpUrl = `/pets/pet_${id}_thumb.webp`;

  // If both WebP files exist on disk, reuse them
  if (fs.existsSync(webpCardPath) && fs.existsSync(webpThumbPath)) {
    pet.image_webp = cardWebpUrl;
    pet.thumb_webp = thumbWebpUrl;
    return { id, status: 'cached' };
  }

  const remoteUrl = pet.image_url || pet.image;
  if (!remoteUrl || remoteUrl.includes('Photo-Not-Available') || !remoteUrl.startsWith('http')) {
    // Fallback to placeholder
    pet.image_webp = '/placeholder.svg';
    pet.thumb_webp = '/placeholder.svg';
    return { id, status: 'placeholder' };
  }

  try {
    console.log(`[${index + 1}/${total}] Fetching photo for ${pet.name} (#${id})...`);
    const imgBuffer = await fetchWithTimeout(remoteUrl);

    // 1. Generate Card WebP (480x360 cover)
    await sharp(imgBuffer)
      .resize(480, 360, { fit: 'cover', position: 'center' })
      .webp({ quality: 80, effort: 4 })
      .toFile(webpCardPath);

    // 2. Generate Thumbnail WebP (160x120 cover)
    await sharp(imgBuffer)
      .resize(160, 120, { fit: 'cover', position: 'center' })
      .webp({ quality: 75, effort: 4 })
      .toFile(webpThumbPath);

    pet.image_webp = cardWebpUrl;
    pet.thumb_webp = thumbWebpUrl;
    return { id, status: 'optimized' };
  } catch (err) {
    console.warn(`[PetPhotoOpt] Warning: Failed to transcode #${id} (${pet.name}): ${err.message}`);
    // Keep remote URL as fallback
    pet.image_webp = remoteUrl;
    pet.thumb_webp = remoteUrl;
    return { id, status: 'failed', error: err.message };
  }
}

async function run() {
  console.log('=== Monroe Humane Pet Photo Optimization Pipeline ===');
  console.log('Public pets output:', PUBLIC_PETS_DIR);

  if (!fs.existsSync(SRC_PETS_JSON)) {
    console.error('Error: Cannot find shelter-pets.json at', SRC_PETS_JSON);
    process.exit(1);
  }

  const pets = JSON.parse(fs.readFileSync(SRC_PETS_JSON, 'utf-8'));
  console.log(`Loaded ${pets.length} active pets from catalog.`);

  let optimized = 0;
  let cached = 0;
  let skipped = 0;
  let failed = 0;

  // Process with concurrency limit
  for (let i = 0; i < pets.length; i += CONCURRENCY) {
    const chunk = pets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((pet, idx) => processPet(pet, i + idx, pets.length)));
    results.forEach((r) => {
      if (r.status === 'optimized') optimized++;
      else if (r.status === 'cached') cached++;
      else if (r.status === 'placeholder') skipped++;
      else if (r.status === 'failed') failed++;
    });
  }

  // Write updated catalog to both locations
  const jsonStr = JSON.stringify(pets, null, 2);
  fs.writeFileSync(SRC_PETS_JSON, jsonStr, 'utf-8');
  fs.writeFileSync(PUBLIC_PETS_JSON, jsonStr, 'utf-8');

  console.log('=== Optimization Complete ===');
  console.log(`Total: ${pets.length} | Newly Optimized: ${optimized} | Reused Cached: ${cached} | Placeholders: ${skipped} | Failed: ${failed}`);
  console.log('Updated shelter-pets.json catalogs written successfully.');
}

run().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
