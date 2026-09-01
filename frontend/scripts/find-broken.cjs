
const fs = require("fs");
const path = require("path");
function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".astro")) {
            const t = fs.readFileSync(p, "utf8");
            if (t.includes("src={${")) console.log(p);
        }
    });
}
walk("src");

