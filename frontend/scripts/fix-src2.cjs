
const fs = require("fs");
let text = fs.readFileSync("src/pages/dog-and-cat-shelter/index.astro", "utf8");
text = text.replace(/src=\{\$\{IMG\}([^\}]+)\}/g, (match, p1) => {
    return "src={`" + "${IMG}" + p1 + "`}";
});
fs.writeFileSync("src/pages/dog-and-cat-shelter/index.astro", text);

