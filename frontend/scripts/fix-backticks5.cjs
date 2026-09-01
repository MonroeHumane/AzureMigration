
const fs = require("fs");
let text = fs.readFileSync("src/pages/dog-and-cat-shelter/index.astro", "utf8");
text = text.replace(/src: [^\n]+/g, (match) => {
    const m = match.match(/(\/[a-zA-Z0-9_.-]+.jpg)/);
    if (m) return "src: `" + "${IMG}" + m[1] + "`\,";
    return match;
});
fs.writeFileSync("src/pages/dog-and-cat-shelter/index.astro", text);

