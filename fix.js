const fs = require('fs');
let content = fs.readFileSync('C:/Users/Jeff/Documents/AzureMigration/frontend/src/pages/games/index.astro', 'utf8');

content = content.replace(/AdoptÃ©dex/g, 'Adoptédex');
content = content.replace(/ðŸ ¾/g, '🐾');
content = content.replace(/Ã¢â‚¬â€ /g, '—');
content = content.replace(/ðŸ“–/g, '📖');
content = content.replace(/ðŸ  /g, '🏠');
content = content.replace(/â€º/g, '›');
content = content.replace(/âœ•/g, '✕');

fs.writeFileSync('C:/Users/Jeff/Documents/AzureMigration/frontend/src/pages/games/index.astro', content, 'utf8');