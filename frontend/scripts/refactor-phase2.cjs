const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');

// 1. Add Imports
const imports = `import HomeFAQ from '../components/home/HomeFAQ.astro';
import HomeAccomplishments from '../components/home/HomeAccomplishments.astro';
import HomeGames from '../components/home/HomeGames.astro';
import HomeContact from '../components/home/HomeContact.astro';\n`;
text = text.replace('import HomeEvents', imports + 'import HomeEvents');

// 2. Replace FAQ HTML with Component
const faqRegex = /<!-- 15\. FAQ -->(.|\n)*?(?=<!-- 16\. Accomplishments)/g;
text = text.replace(faqRegex, '<!-- 15. FAQ -->\n    <HomeFAQ home={home} />\n\n    ');

// 3. Replace Accomplishments HTML with Component
const accRegex = /<!-- 16\. Accomplishments -->(.|\n)*?(?=<!-- 17\. Games)/g;
text = text.replace(accRegex, '<!-- 16. Accomplishments -->\n    <HomeAccomplishments home={home} />\n\n    ');

// 4. Replace Games HTML with Component
const gamesRegex = /<!-- 17\. Games -->(.|\n)*?(?=<!-- 18\. Contact)/g;
text = text.replace(gamesRegex, '<!-- 17. Games -->\n    <HomeGames home={home} />\n\n    ');

// 5. Replace Contact HTML with Component
const contactRegex = /<!-- 18\. Contact -->(.|\n)*?(?=<script>)/g;
text = text.replace(contactRegex, '<!-- 18. Contact -->\n    <HomeContact home={home} />\n  </div>\n</BaseLayout>\n\n  ');

fs.writeFileSync('src/pages/index.astro', text, 'utf8');
console.log('Updated index.astro for Phase 2');