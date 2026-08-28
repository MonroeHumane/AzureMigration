const{execSync}=require("child_process");const{writeFileSync}=require("fs");
const raw=execSync("git show a5912e0:frontend/src/pages/games/index.astro",{cwd:"C:/Users/Jeff/Documents/AzureMigration",encoding:"buffer"});
writeFileSync("C:/Users/Jeff/Documents/AzureMigration/frontend/src/pages/games/index.astro",raw);
console.log("Done,",raw.length,"bytes");