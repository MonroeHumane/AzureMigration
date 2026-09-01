const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.astro')) results.push(file);
        }
    });
    return results;
}

const pages = walk('src/pages');
let modifiedCount = 0;

for (const file of pages) {
    // Skip index.astro (homepage) since it uses BaseLayout but doesn't have a <main> inside
    if (file === 'src\\pages\\index.astro' || file === 'src/pages/index.astro') continue;

    let text = fs.readFileSync(file, 'utf8');
    
    // Check if the page has a <main> tag.
    if (text.includes('<main') && text.includes('</main>')) {
        // Change <main to <div
        let newText = text.replace(/<main([^>]*)>/g, '<div$1>');
        // Change </main> to </div>
        newText = newText.replace(/<\/main>/g, '</div>');
        
        // Remove pt-32 from the div, since BaseLayout already provides the top padding!
        newText = newText.replace(/class="pt-32\s+/g, 'class="');
        newText = newText.replace(/class="([^"]*)\s+pt-32([^"]*)"/g, 'class="$1$2"');
        
        if (text !== newText) {
            fs.writeFileSync(file, newText, 'utf8');
            console.log(`Fixed nested main & padding in: ${file}`);
            modifiedCount++;
        }
    }
}
console.log(`Done! Modified ${modifiedCount} files.`);