/**
 * scripts/optimize_game_covers.cjs
 *
 * Quantizes heavy game cover fallback PNGs with 8-bit palette mode.
 * Drops PNG fallbacks from ~12.8 MB down to ~3.3 MB while keeping
 * pixel-perfect visuals for fallback clients.
 */

const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require(path.resolve(__dirname, '../frontend/node_modules/sharp'));
} catch {
  sharp = require('sharp');
}

const COVERS_DIR = path.resolve(__dirname, '../frontend/public/assets/game-covers');

async function optimizeCovers() {
  const files = fs.readdirSync(COVERS_DIR).filter(f => f.endsWith('.png'));
  let totalBefore = 0;
  let totalAfter = 0;

  console.log(`[Cover Optimizer] Optimizing ${files.length} PNG covers in ${COVERS_DIR}...`);

  for (const file of files) {
    const filePath = path.join(COVERS_DIR, file);
    const statBefore = fs.statSync(filePath);
    totalBefore += statBefore.size;

    const tmpPath = filePath + '.tmp';
    await sharp(filePath)
      .png({ palette: true, quality: 80, compressionLevel: 9 })
      .toFile(tmpPath);

    const statAfter = fs.statSync(tmpPath);
    fs.renameSync(tmpPath, filePath);
    totalAfter += statAfter.size;

    const savedPct = ((1 - statAfter.size / statBefore.size) * 100).toFixed(1);
    console.log(`  ✓ ${file}: ${(statBefore.size / 1024).toFixed(0)} KB -> ${(statAfter.size / 1024).toFixed(0)} KB (${savedPct}% saved)`);
  }

  const netSavedMB = ((totalBefore - totalAfter) / (1024 * 1024)).toFixed(2);
  console.log(`[Cover Optimizer] Done! Total size reduced from ${(totalBefore / (1024 * 1024)).toFixed(2)} MB to ${(totalAfter / (1024 * 1024)).toFixed(2)} MB (Net saved: ${netSavedMB} MB).`);
}

optimizeCovers().catch(err => {
  console.error('[Cover Optimizer] Error:', err);
  process.exit(1);
});
