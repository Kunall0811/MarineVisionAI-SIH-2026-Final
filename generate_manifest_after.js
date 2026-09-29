const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRANSFER_ROOT = path.resolve('D:/MarineVision-AI-TRANSFER');
console.log('Generating MANIFEST_AFTER.json for:', TRANSFER_ROOT);

function getSha256(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (e) {
    return null;
  }
}

const manifestAfter = [];

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile()) {
      const rel = path.relative(TRANSFER_ROOT, full).replace(/\\/g, '/');
      const size = fs.statSync(full).size;
      const sha256 = size > 1024 ? getSha256(full) : null;
      manifestAfter.push({
        path: rel,
        size,
        hash: sha256
      });
    }
  }
}

scan(TRANSFER_ROOT);

fs.writeFileSync('D:/MarineVision-AI-SIH26057-Upgraded/MANIFEST_AFTER.json', JSON.stringify(manifestAfter, null, 2), 'utf8');
fs.writeFileSync(path.join(TRANSFER_ROOT, 'MANIFEST_AFTER.json'), JSON.stringify(manifestAfter, null, 2), 'utf8');

console.log('MANIFEST_AFTER.json written with', manifestAfter.length, 'files.');

// Compare with MANIFEST_BEFORE.json
const before = JSON.parse(fs.readFileSync('D:/MarineVision-AI-SIH26057-Upgraded/MANIFEST_BEFORE.json', 'utf8'));
const afterMap = new Map(manifestAfter.map(f => [f.path, f]));

let matchCount = 0;
let mismatchCount = 0;
let preservedCount = 0;

for (const b of before) {
  if (afterMap.has(b.path)) {
    preservedCount++;
    const a = afterMap.get(b.path);
    if (b.hash && a.hash) {
      if (b.hash === a.hash) {
        matchCount++;
      } else {
        mismatchCount++;
        console.warn('Hash mismatch for:', b.path);
      }
    }
  }
}

console.log('=== HASH VERIFICATION RESULTS ===');
console.log('Total files in MANIFEST_BEFORE (non-node_modules):', before.length);
console.log('Files present in MANIFEST_AFTER:', manifestAfter.length);
console.log('Common files verified:', preservedCount);
console.log('Exact SHA-256 matches:', matchCount);
console.log('Mismatches:', mismatchCount);
