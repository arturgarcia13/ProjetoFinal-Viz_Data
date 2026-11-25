import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'site');

execSync('npm run build', { stdio: 'inherit', cwd: ROOT });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'dist'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

for (const file of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(PUBLIC, file), path.join(OUT, file));
}
fs.copyFileSync(path.join(ROOT, 'dist', 'app.js'), path.join(OUT, 'dist', 'app.js'));
fs.cpSync(path.join(PUBLIC, 'assets'), path.join(OUT, 'assets'), { recursive: true });

for (const entry of fs.readdirSync(path.join(ROOT, 'data'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.json')) {
    fs.copyFileSync(path.join(ROOT, 'data', entry.name), path.join(OUT, 'data', entry.name));
  }
}

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
