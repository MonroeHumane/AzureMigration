/**
 * scripts/optimize_game_assets.cjs
 *
 * Optimizes heavy game textures and generates high-density WebP derivatives
 * for card frames, booster packs, and background artwork.
 */
const path = require('path');
const fs = require('fs');

const sharp = require(path.resolve(__dirname, '../frontend/node_modules/sharp'));

async function main() {
  console.log('=== OPTIMIZING GAME TEXTURES & CARDS ===');

  const gamesDir = path.resolve(__dirname, '../frontend/public/games');
  const cardsDir = path.resolve(__dirname, '../frontend/public/assets/cards');

  // 1. Optimize biome-grass-tile.png (was 714 KB)
  const grassTilePath = path.join(gamesDir, 'biome-grass-tile.png');
  if (fs.existsSync(grassTilePath)) {
    const originalSize = fs.statSync(grassTilePath).size;
    const buf = await sharp(grassTilePath)
      .png({ compressionLevel: 9, palette: true, quality: 85 })
      .toBuffer();
    fs.writeFileSync(grassTilePath, buf);
    const newSize = fs.statSync(grassTilePath).size;
    console.log(`biome-grass-tile.png: ${(originalSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (${Math.round((1 - newSize / originalSize) * 100)}% saved)`);
  }

  // 2. Optimize parchment-frame.png (was 471 KB)
  const parchmentPath = path.join(gamesDir, 'parchment-frame.png');
  if (fs.existsSync(parchmentPath)) {
    const originalSize = fs.statSync(parchmentPath).size;
    const buf = await sharp(parchmentPath)
      .png({ compressionLevel: 9, palette: true, quality: 85 })
      .toBuffer();
    fs.writeFileSync(parchmentPath, buf);
    const newSize = fs.statSync(parchmentPath).size;
    console.log(`parchment-frame.png: ${(originalSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (${Math.round((1 - newSize / originalSize) * 100)}% saved)`);
  }

  // 3. Optimize cathead.png (was 109 KB)
  const catheadPath = path.join(gamesDir, 'cathead.png');
  if (fs.existsSync(catheadPath)) {
    const originalSize = fs.statSync(catheadPath).size;
    const buf = await sharp(catheadPath)
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();
    fs.writeFileSync(catheadPath, buf);
    const newSize = fs.statSync(catheadPath).size;
    console.log(`cathead.png: ${(originalSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (${Math.round((1 - newSize / originalSize) * 100)}% saved)`);
  }

  // 4. Generate WebP derivatives for card packs & frames in assets/cards
  if (fs.existsSync(cardsDir)) {
    const cardFiles = fs.readdirSync(cardsDir).filter(f => f.endsWith('.png'));
    for (const file of cardFiles) {
      const srcPath = path.join(cardsDir, file);
      const destPath = path.join(cardsDir, file.replace('.png', '.webp'));
      const originalSize = fs.statSync(srcPath).size;
      await sharp(srcPath)
        .webp({ quality: 90, lossless: true })
        .toFile(destPath);
      const webpSize = fs.statSync(destPath).size;
      console.log(`${file} -> ${path.basename(destPath)}: ${(originalSize / 1024).toFixed(1)} KB -> ${(webpSize / 1024).toFixed(1)} KB`);
    }
  }

  console.log('Optimization complete!');
}

main().catch(err => {
  console.error('Error optimizing assets:', err);
  process.exit(1);
});
