'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
}

walk(ROOT);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax error: ${path.relative(ROOT, file)}`);
    console.error(result.stderr.trim());
  }
}
if (failed) process.exit(1);
console.log(`JavaScript syntax check passed for ${files.length} files.`);
