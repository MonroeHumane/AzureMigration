const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');

// 1. Add Imports
const imports = `import HomeEvents from '../components/home/HomeEvents.astro';
import HomeDonations from '../components/home/HomeDonations.astro';
import HomeNewsletter from '../components/home/HomeNewsletter.astro';
import HomeFAQ from '../components/home/HomeFAQ.astro';
import HomeAccomplishments from '../components/home/HomeAccomplishments.astro';
import HomeGames from '../components/home/HomeGames.astro';
import HomeContact from '../components/home/HomeContact.astro';\n`;
if (!text.includes('import HomeEvents')) {
  text = text.replace('import HomeFeaturedPets', imports + 'import HomeFeaturedPets');
}

// Replace Events (from <!-- 2. Events band --> to <!-- 3. Intro -->)
text = text.replace(/<!-- 2\. Events band -->[\s\S]*?(?=<!-- 3\. Intro -->)/, '<!-- 2. Events band -->\n    <HomeEvents home={home} latestEvent={latestEvent} nextEvent={nextEvent} pets={pets} />\n\n    ');

// Replace Donations (from <!-- 12. Donations --> to <!-- 13. Social)
text = text.replace(/<!-- 12\. Donations -->[\s\S]*?(?=<!-- 13\. Social)/, '<!-- 12. Donations -->\n    <HomeDonations home={home} />\n\n    ');

// Replace Newsletter (from <!-- 14. Newsletter to <!-- 15. FAQ)
text = text.replace(/<!-- 14\. Newsletter[\s\S]*?(?=<!-- 15\. FAQ -->)/, '<!-- 14. Newsletter -->\n    <HomeNewsletter home={home} latestNewsletter={latestNewsletter} />\n\n    ');

// Replace FAQ (from <!-- 15. FAQ --> to <!-- 16. Accomplishments)
text = text.replace(/<!-- 15\. FAQ -->[\s\S]*?(?=<!-- 16\. Accomplishments)/, '<!-- 15. FAQ -->\n    <HomeFAQ home={home} />\n\n    ');

// Replace Accomplishments (from <!-- 16. Accomplishments --> to <!-- 17. Games)
text = text.replace(/<!-- 16\. Accomplishments -->[\s\S]*?(?=<!-- 17\. Games)/, '<!-- 16. Accomplishments -->\n    <HomeAccomplishments home={home} />\n\n    ');

// Replace Games (from <!-- 17. Games --> to <!-- 18. Contact)
text = text.replace(/<!-- 17\. Games -->[\s\S]*?(?=<!-- 18\. Contact)/, '<!-- 17. Games -->\n    <HomeGames home={home} />\n\n    ');

// Replace Contact (from <!-- 18. Contact --> to <script>)
text = text.replace(/<!-- 18\. Contact -->[\s\S]*?(?=<\/div>\s*<\/BaseLayout>)/, '<!-- 18. Contact -->\n    <HomeContact home={home} />\n  ');

fs.writeFileSync('src/pages/index.astro', text, 'utf8');
console.log('Fixed index.astro replacements');