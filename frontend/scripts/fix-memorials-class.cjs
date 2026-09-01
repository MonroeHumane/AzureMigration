
const fs = require("fs");
let text = fs.readFileSync("src/pages/memorials/index.astro", "utf8");
text = text.replace(/class=\{w-14 h-14 rounded-2xl flex items-center justify-center\s+border\}/g, "class=\"w-14 h-14 rounded-2xl flex items-center justify-center border\"");
fs.writeFileSync("src/pages/memorials/index.astro", text, "utf8");

