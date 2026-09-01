const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');
const contactRegex = /<!-- 18\. Contact -->[\s\S]*?(?=<script>)/;
text = text.replace(contactRegex, '<!-- 18. Contact -->\n    <HomeContact home={home} />\n  </div>\n</BaseLayout>\n\n');
fs.writeFileSync('src/pages/index.astro', text, 'utf8');