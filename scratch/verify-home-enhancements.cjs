const fs = require('fs');
const html = fs.readFileSync('frontend/dist/index.html', 'utf8');

const checks = [
  ['Side Dock exists', html.includes('id="homeSideDock"')],
  ['Side Dock has On This Page', html.includes('On This Page')],
  ['Side Dock has section links', html.includes('data-dock-target="FeaturedPets"')],
  ['Featured Pets card elevated', html.includes('home-featured-pets-card')],
  ['Featured Pets title', html.includes('Find your next best friend')],
  ['Featured Pets primary CTA', html.includes('Search All Adoptable Pets')],
  ['Facebook adopthsmc used in iframe', html.includes('adopthsmc')],
  ['Split nav parent link exists', html.includes('monroe-global-nav__link--parent')],
  ['Split nav chevron button exists', html.includes('monroe-global-nav__trigger--chevron')],
  ['Community Reviews link exists', html.includes('Community Reviews')],
  ['Testimonials section exists', html.includes('id="Testimonials"')],
];

let allPassed = true;
checks.forEach(([name, passed]) => {
  console.log(passed ? 'PASS:' : 'FAIL:', name);
  if (!passed) allPassed = false;
});

console.log('All checks passed:', allPassed);
