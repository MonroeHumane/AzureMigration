const fs = require('fs');
let code = fs.readFileSync('src/pages/index.astro', 'utf8');

const regex = /<div class="hidden xl:block fixed top-1\/2.*?<\/nav>\s*<div class="home-editable-side-rail">/s;
code = code.replace(regex, '<div class="home-editable-side-rail">');

// Also need to remove the closing </div> of that wrapper.
// Let's find it. It's right before <div class="home-editable-shell
const regex2 = /<\/div>\s*<div class="home-editable-shell is-layout-constrained">/s;
code = code.replace(regex2, '<div class="home-editable-shell is-layout-constrained">');

fs.writeFileSync('src/pages/index.astro', code);
console.log('Fixed index.astro TOC wrapper');
