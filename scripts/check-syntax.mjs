import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const files = ['vite.config.js', 'hardhat.config.cjs', 'public/pages.js'];
for (const root of ['src', 'scripts', 'test']) {
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (fs.statSync(full).isFile() && /\.(js|mjs|cjs)$/.test(name)) files.push(full);
  }
}
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  // Parsing all files in one Node process is much faster than spawning 23+
  // Node subprocesses on resource-limited CI runners.
  try {
    if (file.endsWith('.cjs')) new vm.Script(source, { filename: file });
    else new vm.SourceTextModule(source, { identifier: file });
  } catch (error) {
    throw new Error(`Syntax check failed: ${file}: ${String(error)}`, { cause: error });
  }
  console.log(`OK: ${file}`);
}
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
