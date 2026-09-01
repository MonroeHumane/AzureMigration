const fs = require('fs');
let text = fs.readFileSync('src/pages/index.astro', 'utf8');

// Add imports
const imports = `import HomeSponsors from '../components/home/HomeSponsors.astro';
import HomePartners from '../components/home/HomePartners.astro';
import HomeTestimonials from '../components/home/HomeTestimonials.astro';\n`;
if (!text.includes('import HomeSponsors')) {
  text = text.replace('import HomeContact', imports + 'import HomeContact');
}

// Replace Vet Partners & Auction Sponsors (from <!-- 7. Vet partners --> to <!-- 9. Community partners marquee -->)
text = text.replace(/<!-- 7\. Vet partners -->[\s\S]*?(?=<!-- 9\. Community partners marquee -->)/, '<!-- 7. Vet & Auction Sponsors -->\n    <HomeSponsors home={home} sponsors={sponsors} />\n\n    ');

// Replace Community Partners & Membership (from <!-- 9. Community partners marquee --> to <!-- 11. Testimonials -->)
text = text.replace(/<!-- 9\. Community partners marquee -->[\s\S]*?(?=<!-- 11\. Testimonials -->)/, '<!-- 9. Community Partners & Membership -->\n    <HomePartners home={home} sponsors={sponsors} />\n\n    ');

// Replace Testimonials (from <!-- 11. Testimonials --> to <!-- 12. Donations -->)
text = text.replace(/<!-- 11\. Testimonials -->[\s\S]*?(?=<!-- 12\. Donations -->)/, '<!-- 11. Testimonials -->\n    <HomeTestimonials home={home} reviews={reviewsData} />\n\n    ');

fs.writeFileSync('src/pages/index.astro', text, 'utf8');
console.log('Fixed index.astro for Phase 3');