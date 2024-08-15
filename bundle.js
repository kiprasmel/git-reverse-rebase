#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const EXE = "git-reverse-rebase";

cp.execSync("yarn build");
cp.execSync(`npx esbuild dist/git-reverse-rebase.js --bundle --platform=node --outfile=${EXE}`);

const lines = fs.readFileSync(EXE).toString().split("\n");

lines[0] = "#!/usr/bin/env node";

const file = lines.join("\n");
fs.writeFileSync(EXE, file, { encoding: "utf-8", mode: 0o777 });

if (process.env.INSTALL_DIR) {
	const dir = process.env.INSTALL_DIR;
	fs.mkdirSync(dir, { recursive: true });

	const newPath = path.join(dir, EXE);
	fs.renameSync(EXE, newPath);
	console.log(newPath);
}
