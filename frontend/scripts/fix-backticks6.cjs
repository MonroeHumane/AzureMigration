
const fs = require("fs");
let text = fs.readFileSync("src/pages/dog-and-cat-shelter/index.astro", "utf8");
text = text.replace(/src=\{([^\}]+)\}/g, (match, p1) => {
    if (p1.startsWith("${IMG}")) {
        return "src={`" + p1 + "`}";
    }
    return match;
});
fs.writeFileSync("src/pages/dog-and-cat-shelter/index.astro", text);

