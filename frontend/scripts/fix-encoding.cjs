const fs = require('fs');
const content = fs.readFileSync('src/pages/dog-and-cat-shelter/index.astro', 'latin1');
fs.writeFileSync('src/pages/dog-and-cat-shelter/index.astro', content, 'utf8');
