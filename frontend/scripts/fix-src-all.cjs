
const fs = require("fs");
const files = [
    "src/pages/events/index.astro",
    "src/pages/contact/index.astro",
    "src/pages/dog-and-cat-shelter/index.astro",
    "src/pages/memorials/index.astro",
    "src/pages/games/index.astro"
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, "utf8");
        let changed = false;
        text = text.replace(/src=\{\$\{IMG\}([^\}]+)\}/g, (match, p1) => {
            changed = true;
            return "src={`" + "${IMG}" + p1 + "`}";
        });
        if (changed) {
            fs.writeFileSync(file, text, "utf8");
            console.log("Fixed src in", file);
        }
    }
}

