const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC_ROOT = path.resolve('D:/MarineVision-AI-SIH26057-Upgraded');
const DST_ROOT = path.resolve('D:/MarineVision-AI-TRANSFER');

console.log('=== MarineVision AI Transfer Package Builder ===');
console.log('Source:', SRC_ROOT);
console.log('Destination:', DST_ROOT);

// 1. Prepare destination directory
if (fs.existsSync(DST_ROOT)) {
  console.log('Cleaning existing destination directory...');
  fs.rmSync(DST_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(DST_ROOT, { recursive: true });

function getSha256(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (e) {
    return null;
  }
}

// Map of sha256 -> destination absolute path
const canonicalCopied = new Map();
let totalFilesCopied = 0;
let totalBytesCopied = 0;
let totalHardlinksCreated = 0;
let totalBytesSavedByDeduplication = 0;

function copyOrHardlinkFile(srcPath, dstPath) {
  const dstDir = path.dirname(dstPath);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const stat = fs.statSync(srcPath);
  const size = stat.size;

  // For files larger than 1KB, check if we already have an identical copy in DST
  if (size > 1024) {
    const sha = getSha256(srcPath);
    if (sha && canonicalCopied.has(sha)) {
      const existingDst = canonicalCopied.get(sha);
      try {
        fs.linkSync(existingDst, dstPath);
        totalHardlinksCreated++;
        totalBytesSavedByDeduplication += size;
        return;
      } catch (err) {
        // Fallback to copy if hardlink fails
      }
    } else if (sha) {
      fs.copyFileSync(srcPath, dstPath);
      canonicalCopied.set(sha, dstPath);
      totalFilesCopied++;
      totalBytesCopied += size;
      return;
    }
  }

  fs.copyFileSync(srcPath, dstPath);
  totalFilesCopied++;
  totalBytesCopied += size;
}

function copyDirectoryRecursive(srcDir, dstDir, filterFn) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);

    if (filterFn && !filterFn(srcPath, entry.isDirectory())) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, dstPath, filterFn);
    } else if (entry.isFile()) {
      copyOrHardlinkFile(srcPath, dstPath);
    }
  }
}

console.log('Copying datasets (images, labels, yaml config)...');
// Copy datasets first so they serve as canonical copies for training images
copyDirectoryRecursive(
  path.join(SRC_ROOT, 'datasets'),
  path.join(DST_ROOT, 'datasets')
);

// Also provide data.yaml in datasets for standard Ultralytics compatibility
if (fs.existsSync(path.join(DST_ROOT, 'datasets', 'dataset.yaml')) && !fs.existsSync(path.join(DST_ROOT, 'datasets', 'data.yaml'))) {
  fs.copyFileSync(path.join(DST_ROOT, 'datasets', 'dataset.yaml'), path.join(DST_ROOT, 'datasets', 'data.yaml'));
}

console.log('Copying AI models...');
copyDirectoryRecursive(path.join(SRC_ROOT, 'ai-models'), path.join(DST_ROOT, 'ai-models'));
copyDirectoryRecursive(path.join(SRC_ROOT, 'models'), path.join(DST_ROOT, 'models'));

console.log('Copying runs / checkpoints...');
copyDirectoryRecursive(path.join(SRC_ROOT, 'runs'), path.join(DST_ROOT, 'runs'));

console.log('Copying backend (source, configs, pre-built dist, sonar-storage)...');
copyDirectoryRecursive(
  path.join(SRC_ROOT, 'backend'),
  path.join(DST_ROOT, 'backend'),
  (p, isDir) => {
    const rel = path.relative(path.join(SRC_ROOT, 'backend'), p).replace(/\\/g, '/');
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
    if (rel.endsWith('.log')) return false;
    return true;
  }
);

console.log('Copying frontend (source, public, configs)...');
copyDirectoryRecursive(
  path.join(SRC_ROOT, 'frontend'),
  path.join(DST_ROOT, 'frontend'),
  (p, isDir) => {
    const rel = path.relative(path.join(SRC_ROOT, 'frontend'), p).replace(/\\/g, '/');
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
    if (rel.endsWith('.log')) return false;
    return true;
  }
);

console.log('Copying ml, docs, reports, training...');
copyDirectoryRecursive(path.join(SRC_ROOT, 'ml'), path.join(DST_ROOT, 'ml'));
copyDirectoryRecursive(path.join(SRC_ROOT, 'docs'), path.join(DST_ROOT, 'docs'));
copyDirectoryRecursive(path.join(SRC_ROOT, 'reports'), path.join(DST_ROOT, 'reports'));
copyDirectoryRecursive(path.join(SRC_ROOT, 'training'), path.join(DST_ROOT, 'training'));

console.log('Copying root scripts, documentation, and metadata files...');
const rootFiles = [
  'README.md',
  'DEMO_GUIDE.md',
  'MODEL_CARD.md',
  'DATASET_SOURCES.md',
  'PS_COMPLIANCE.md',
  'UPGRADE_AUDIT.md',
  'CHANGELOG_2026-09.md',
  'CHANGELOG_2026-09-ML-PIPELINE.md',
  'docker-compose.yml',
  'start-demo.ps1',
  'TRAIN_MODEL.bat',
  'train.sh',
  'class_mapping.json',
  'class_distribution.json',
  'create_yolo26x_model.py',
  'build_trained_model.py',
  'IMAGE_MANIFEST.json',
  'SIZE_AUDIT_BEFORE.txt',
  'MANIFEST_BEFORE.json',
  'yolo11n.pt'
];

for (const rf of rootFiles) {
  const src = path.join(SRC_ROOT, rf);
  if (fs.existsSync(src)) {
    copyOrHardlinkFile(src, path.join(DST_ROOT, rf));
  }
}

// Write README_TRANSFER.md in transfer root
const readmeTransfer = `# MarineVision AI - Transfer Package (SIH26057)

This package contains the fully optimized, transferable distribution of **MarineVision AI**:
- Full AI pipeline with fine-tuned YOLO26x ONNX Side-Scan Sonar detection model
- Complete NestJS backend (pre-compiled in \`backend/dist\` for instant demo execution)
- Complete React + Vite + Cesium 3D GIS interactive command frontend
- Full side-scan sonar datasets with train, val, and test splits (images, YOLO annotations, class mapping)
- Deduplicated survey sonar storage with 100% path compatibility
- Complete IMAGE_MANIFEST.json documenting every single image, dimensions, SHA-256, coordinates, and bounding boxes

## Quick Start (Run Instantly)

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB running on \`localhost:27017\` (or docker compose up -d)

### 2. Run Backend
\`\`\`bash
cd backend
npm install
npm run start:prod
# Or run with Node directly:
node dist/main.js
\`\`\`
The backend starts at http://localhost:4000 (Swagger docs: http://localhost:4000/api/docs).

### 3. Run Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
The frontend starts at http://localhost:5173.

### 4. Verify AI Model Inference
\`\`\`bash
python create_yolo26x_model.py
\`\`\`
Or test live detection in the frontend "AI Quick Test" tab.
`;

fs.writeFileSync(path.join(DST_ROOT, 'README_TRANSFER.md'), readmeTransfer, 'utf8');

console.log('=== TRANSFER PACKAGE CREATION SUMMARY ===');
console.log('Unique Physical Files Copied:', totalFilesCopied);
console.log('Physical Bytes Stored on Disk:', (totalBytesCopied / 1024 / 1024 / 1024).toFixed(3), 'GB (' + (totalBytesCopied / 1024 / 1024).toFixed(2) + ' MB)');
console.log('Hardlinks (Deduplicated Files):', totalHardlinksCreated);
console.log('Bytes Saved by Hardlink Deduplication:', (totalBytesSavedByDeduplication / 1024 / 1024 / 1024).toFixed(3), 'GB (' + (totalBytesSavedByDeduplication / 1024 / 1024).toFixed(2) + ' MB)');
