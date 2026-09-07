const fs = require('fs');
const html = fs.readFileSync('frontend/dist/internal/index.html', 'utf8');

const path = require('path');
const astroDir = 'frontend/dist/_astro';
let bundledJs = '';
if (fs.existsSync(astroDir)) {
  for (const file of fs.readdirSync(astroDir)) {
    if (file.endsWith('.js')) {
      bundledJs += fs.readFileSync(path.join(astroDir, file), 'utf8');
    }
  }
}

const checks = {
  'Email clear button in HTML': html.includes('id="email-clear-btn"'),
  'Login help toggle in HTML': html.includes('id="login-help-toggle"'),
  'Login help drawer in HTML': html.includes('id="login-help-drawer"'),
  'Pre-paint token age check in HTML': html.includes('2592000000'),
  'Dark help drawer style in HTML': html.includes('#login-help-drawer'),
  'Live cooldown timer in Bundle': bundledJs.includes('Wait 60s') || bundledJs.includes('cooldownSec'),
  'Remembered email check in Bundle': bundledJs.includes('mchs_staff_user') && bundledJs.includes('mchs_staff_remember'),
  'Email clear handler in Bundle': bundledJs.includes('email-clear-btn'),
  'Login help toggle handler in Bundle': bundledJs.includes('login-help-toggle'),
};

console.table(checks);

const faqHtml = fs.readFileSync('frontend/dist/faq/index.html', 'utf8');
const faqChecks = {
  'FAQ search input': faqHtml.includes('id="faqSearch"'),
  'FAQ card trigger': faqHtml.includes('faq-trigger'),
  'FAQ expand/collapse': faqHtml.includes('id="faqToggleAll"'),
  'FAQ idempotent dataset guard': faqHtml.includes('dataset.bound'),
};

console.table(faqChecks);
