const fs = require('fs');
let code = fs.readFileSync('src/pages/index.astro', 'utf8');
code = code.replace(/import { SITE } from '\.\.\/config\/site';/, "import { SITE } from '../config/site';\nimport '../styles/monroe-home.css';\nimport '../styles/monroe-home-widgets.css';");
fs.writeFileSync('src/pages/index.astro', code);
console.log('Added CSS back to index.astro');
