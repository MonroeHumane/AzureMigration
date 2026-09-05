const fs = require('fs');
const html = fs.readFileSync('frontend/dist/internal/donors/index.html', 'utf8');

console.log('Dist donors HTML length:', html.length);
console.log('Has 832,617.95:', html.includes('832,617.95'));
console.log('Has 2,430:', html.includes('2,430'));
console.log('Has donor-table-body:', html.includes('id="donor-table-body"'));
console.log('Has export-donors-csv-btn:', html.includes('id="export-donors-csv-btn"'));
console.log('Has donor-search-input:', html.includes('id="donor-search-input"'));

// Check for emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const matches = html.match(new RegExp(emojiRegex.source, 'gu')) || [];
console.log('Emojis found in dist/internal/donors/index.html:', matches.length, matches.slice(0, 5));
