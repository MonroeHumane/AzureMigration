const fs = require('fs');
let text = fs.readFileSync('src/pages/dog-and-cat-shelter/index.astro', 'utf8');
text = text.replace(/src: \\\\\\\/(.*?)\\\\, \\n/g, 'src: ${IMG}/,\\n');
fs.writeFileSync('src/pages/dog-and-cat-shelter/index.astro', text);
