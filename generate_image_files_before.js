const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('D:/MarineVision-AI-SIH26057-Upgraded');
console.log('Auditing all image files in:', ROOT);

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff', '.gif']);

const images = [];
const extStats = {};
let totalBytes = 0;
let largest = { path: null, size: 0 };

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        const stat = fs.statSync(full);
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        const size = stat.size;

        totalBytes += size;
        if (size > largest.size) {
          largest = { path: rel, size };
        }

        extStats[ext] = extStats[ext] || { count: 0, bytes: 0 };
        extStats[ext].count++;
        extStats[ext].bytes += size;

        images.push({ path: rel, size, ext });
      }
    }
  }
}

scan(ROOT);

function fmt(b) {
  if (b >= 1024 * 1024 * 1024) return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
  return b + ' B';
}

let out = `================================================================================
IMAGE FILES AUDIT BEFORE REMOVAL - MARINEVISION AI / SIH26057
Timestamp: ${new Date().toISOString()}
Root Directory: ${ROOT}
================================================================================

SUMMARY STATISTICS:
--------------------------------------------------------------------------------
Total Image Files Found:  ${images.length}
Total Image Storage Size: ${fmt(totalBytes)} (${totalBytes} bytes)
Largest Image:            ${largest.path} (${fmt(largest.size)})

BREAKDOWN BY EXTENSION:
--------------------------------------------------------------------------------
${Object.entries(extStats)
  .sort((a, b) => b[1].bytes - a[1].bytes)
  .map(([ext, s]) => `${ext.toUpperCase().padEnd(8)}: ${s.count.toString().padStart(6)} files | ${fmt(s.bytes).padStart(12)} (${s.bytes} bytes)`)
  .join('\n')}

================================================================================
COMPLETE LIST OF REMOVABLE IMAGE PATHS (${images.length} FILES):
================================================================================
${images.map(img => `${img.path.padEnd(75)} [${fmt(img.size).padStart(9)}]`).join('\n')}

================================================================================
END OF AUDIT
================================================================================
`;

fs.writeFileSync(path.join(ROOT, 'IMAGE_FILES_BEFORE.txt'), out, 'utf8');
console.log('IMAGE_FILES_BEFORE.txt written successfully with', images.length, 'images (' + fmt(totalBytes) + ').');
