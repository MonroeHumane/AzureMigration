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
        try {
            const buf = fs.readFileSync(file);
            let str = '';
            for (let i = 0; i < buf.length; i++) {
                if (buf[i] > 127) {
                   if (buf[i] === 0xe2 && buf[i+1] === 0x80) {
                      // utf-8 dash or quote, might be okay if it was valid, but let's assume it's broken
                      // Wait, I can just use a simple regex replace if I decode as latin1
                   }
                }
            }
            // A much easier way to fix it is to just decode it gracefully.
            // If it's valid UTF-8, it will stay valid. If it has broken bytes, let's fix them.
            // If I just decode from 'latin1', the bytes > 127 become characters > 127.
            // Then I can write it back as utf-8. BUT if it was UTF-8 to begin with, latin1->utf8 will mangle it!
        } catch (e) {}
    }
}
