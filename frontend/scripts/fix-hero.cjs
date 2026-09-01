const fs = require('fs');
let code = fs.readFileSync('src/components/home/HomeHero.astro', 'utf8');
code = code.replace(/<div class="relative min-h-\[600px\]/, '<div class="alignfull relative min-h-[600px]');
fs.writeFileSync('src/components/home/HomeHero.astro', code);
console.log('Fixed HomeHero.astro');
