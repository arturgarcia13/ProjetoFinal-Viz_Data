import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'site');

execSync('npm run build', { stdio: 'inherit', cwd: ROOT });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'dist'), { recursive: true });

for (const file of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(ROOT, file), path.join(OUT, file));
}
fs.copyFileSync(path.join(ROOT, 'dist', 'app.js'), path.join(OUT, 'dist', 'app.js'));
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'data'), path.join(OUT, 'data'), { recursive: true });

let totalBytes = 0;
let fileCount = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      totalBytes += fs.statSync(full).size;
      fileCount += 1;
    }
  }
}
walk(OUT);
console.log(`Vercel output ready in site/: ${fileCount} files (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
