const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.astro') || file.endsWith('.ts') || file.endsWith('.json')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getFiles(SRC_DIR);
const terms = ['todo', 'fixme', 'lorem', 'ipsum', 'dummy', 'fake', 'coming soon', 'under construction', 'sample', 'mock'];

console.log(`Auditing ${files.length} page/component files...`);

let issuesFound = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Check for search terms (case-insensitive)
    for (const term of terms) {
      if (line.toLowerCase().includes(term)) {
        // Filter out false positives
        if (line.includes('Sample') && file.endsWith('donor_database.json')) continue;
        if (line.includes('Mockingbird') || line.includes('Smock')) continue;
        if (line.includes('class=') && line.includes('mock')) continue;
        
        console.log(`[${term.toUpperCase()}] ${path.relative(SRC_DIR, file)}:${idx + 1}`);
        console.log(`   ${line.trim()}`);
        issuesFound++;
      }
    }

    // Check for bracket placeholders like [Word ...]
    const bracketMatch = line.match(/\[([A-Z][a-zA-Z\s]{2,})\]/g);
    if (bracketMatch) {
      // ignore ts / js type casting or console logs
      if (!line.includes('console.') && !line.includes('type') && !line.includes('import') && !line.includes('data-') && !line.includes('headers')) {
        console.log(`[BRACKET] ${path.relative(SRC_DIR, file)}:${idx + 1}`);
        console.log(`   ${line.trim()}`);
        issuesFound++;
      }
    }
  });
});

console.log(`\nAudit complete. Total findings: ${issuesFound}`);
