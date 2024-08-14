#!/usr/bin/env node

const fs = require("fs");
const cp = require("child_process");

const EXE = "git-reverse-rebase";

cp.execSync("yarn build");
cp.execSync(`npx esbuild dist/git-reverse-rebase.js --bundle --platform=node --outfile=${EXE}`);

const lines = fs.readFileSync(EXE).toString().split("\n");

lines[0] = "#!/usr/bin/env node";

const file = lines.join("\n");
fs.writeFileSync(EXE, file, { encoding: "utf-8", mode: 0o777 });
