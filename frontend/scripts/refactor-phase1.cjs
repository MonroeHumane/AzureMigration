const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');

// 1. Add Imports
const imports = `import HomeEvents from '../components/home/HomeEvents.astro';
import HomeDonations from '../components/home/HomeDonations.astro';
import HomeNewsletter from '../components/home/HomeNewsletter.astro';\n`;
text = text.replace('import HomeFeaturedPets', imports + 'import HomeFeaturedPets');

// 2. Replace Events HTML with Component
const eventsRegex = /<!-- 2\. Events band -->(.|\n)*?(?=<!-- 3\. Intro -->)/g;
text = text.replace(eventsRegex, '<!-- 2. Events band -->\n    <HomeEvents home={home} latestEvent={latestEvent} nextEvent={nextEvent} pets={pets} />\n\n    ');

// 3. Replace Donations HTML with Component
const donationsRegex = /<!-- 12\. Donations -->(.|\n)*?(?=<!-- 13\. Social)/g;
text = text.replace(donationsRegex, '<!-- 12. Donations -->\n    <HomeDonations home={home} />\n\n    ');

// 4. Replace Newsletter HTML with Component
const newsletterRegex = /<div class="wp-block-group alignwide home-editable-section home-editable-newsletter-section(.|\n)*?(?=<!-- 7\. FAQ -->)/g;
text = text.replace(newsletterRegex, '<HomeNewsletter home={home} latestNewsletter={latestNewsletter} />\n\n    ');

fs.writeFileSync('src/pages/index.astro', text, 'utf8');
console.log('Updated index.astro');