const fs = require('fs');
let text = fs.readFileSync('src/pages/dog-and-cat-shelter/index.astro', 'utf8');
text = text.replace(/src: \\\\\\\/452546926_883292250498381_6921668243561390358_n-1920w.jpg\\\\, \\n/g, 'src: \\${IMG}/452546926_883292250498381_6921668243561390358_n-1920w.jpg\\,\\n');
fs.writeFileSync('src/pages/dog-and-cat-shelter/index.astro', text);
