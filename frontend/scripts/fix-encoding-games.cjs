const fs = require('fs');
let text = fs.readFileSync('src/pages/games/index.astro', 'latin1');
text = text.replace(/\xe9/g, 'é'); // map ANSI e9 to UTF-8 é
fs.writeFileSync('src/pages/games/index.astro', text, 'utf8');
