const fs = require('fs');
const files = [
    'src/pages/events/index.astro',
    'src/pages/contact/index.astro',
    'src/pages/dog-and-cat-shelter/index.astro',
    'src/pages/memorials/index.astro',
    'src/pages/games/index.astro'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        let str = '';
        for (let i = 0; i < buf.length; i++) {
            const b = buf[i];
            if (b === 0x96) str += '-';
            else if (b === 0x97) str += '-';
            else if (b === 0x92) str += "'";
            else if (b === 0x93 || b === 0x94) str += '"';
            else if (b === 0x85) str += '...';
            else if (b > 127) {
                // Default fallback for other invalid bytes if any exist
                str += String.fromCharCode(b);
            } else {
                str += String.fromCharCode(b);
            }
        }
        fs.writeFileSync(file, str, 'utf8');
        console.log('Fixed', file);
    }
}
