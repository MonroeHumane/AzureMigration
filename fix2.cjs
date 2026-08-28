const fs = require("fs");
let c = fs.readFileSync("C:/Users/Jeff/Documents/AzureMigration/frontend/src/pages/index.astro", "utf8");

// Remove the duplicate block: starting from the orphaned "    }" and second copy of fpwDialog
const badStart = "    // Contact form: mailto submission (no backend on the static site).\n    }\n    // Featured pets: Expand view opens a <dialog> with the same cards.\n    const fpwDialog = document.getElementById('featuredPetsFsDialog') as HTMLDialogElement | null;\n    const fpwExpand = document.getElementById('fpwExpandBtn');\n    if (fpwDialog && fpwExpand) {";

const idx = c.indexOf(badStart);
if (idx > -1) {
  // Find the ending "  }" that closes initHomePage (after the second contact form if block)
  // Find second occurrence of "  document.addEventListener('astro:page-load', initHomePage);"
  let end = c.indexOf("  document.addEventListener('astro:page-load', initHomePage);", idx);
  if (end > -1) {
    // Remove everything from badStart to the initHomePage line (exclusive)
    const before = c.slice(0, idx);
    const after = c.slice(end);
    c = before + "\n  }\n\n  " + after;
    fs.writeFileSync("C:/Users/Jeff/Documents/AzureMigration/frontend/src/pages/index.astro", c, "utf8");
    console.log("Fixed! Removed duplicate block.");
  } else {
    console.log("Could not find end marker");
  }
} else {
  console.log("Bad start not found. File may already be clean or has different line endings.");
  // Check for CRLF version
  const badStartCRLF = badStart.replace(/\n/g, "\r\n");
  console.log("Trying CRLF, found:", c.includes(badStartCRLF));
}