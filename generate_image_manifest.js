const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getSha256(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (e) {
    return null;
  }
}

function getDimensions(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(32);
    fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);
    if (buffer.toString('ascii', 1, 4) === 'PNG') {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        format: 'PNG'
      };
    }
  } catch (e) {}
  return { width: null, height: null, format: path.extname(filePath).slice(1).toUpperCase() };
}

const CLASS_NAMES = [
  'shipwreck',
  'artificial_structure',
  'rock',
  'marine_debris',
  'container',
  'pipe',
  'cylinder',
  'ghost_net'
];

function getYoloAnnotations(imagePath) {
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  const dir = path.dirname(imagePath);
  const parent = path.dirname(dir);
  const labelPath = path.join(parent, 'labels', `${baseName}.txt`);

  if (!fs.existsSync(labelPath)) return [];

  const content = fs.readFileSync(labelPath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const annotations = [];

  for (const line of lines) {
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 5) {
      const classId = parts[0];
      const className = CLASS_NAMES[classId] || `class_${classId}`;
      annotations.push({
        classId,
        className,
        x_center: parts[1],
        y_center: parts[2],
        width: parts[3],
        height: parts[4]
      });
    }
  }
  return annotations;
}

const manifest = [];
const seenHashes = new Map();

function processDirectory(dir, defaultSplit, defaultSource) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath, defaultSplit, defaultSource);
    } else if (/\.(png|jpg|jpeg|webp|bmp|tif|tiff)$/i.test(entry.name)) {
      const relPath = path.relative('.', fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      const sha256 = getSha256(fullPath);
      const dims = getDimensions(fullPath);
      const annotations = getYoloAnnotations(fullPath);

      let split = defaultSplit || 'unassigned';
      if (relPath.includes('/train/')) split = 'train';
      else if (relPath.includes('/val/')) split = 'val';
      else if (relPath.includes('/test/')) split = 'test';
      else if (relPath.includes('AI-BATCH')) split = 'survey_batch';
      else if (relPath.includes('SURV-HIST-NOAA')) split = 'historical_noaa';
      else if (relPath.includes('training/')) split = 'operator_training_submission';

      let className = null;
      if (annotations.length > 0) {
        className = annotations[0].className;
      } else {
        for (const c of CLASS_NAMES) {
          if (entry.name.toLowerCase().includes(c)) {
            className = c;
            break;
          }
        }
      }

      let canonicalPath = relPath;
      let isDuplicate = false;
      if (seenHashes.has(sha256)) {
        canonicalPath = seenHashes.get(sha256);
        isDuplicate = true;
      } else {
        seenHashes.set(sha256, relPath);
      }

      const surveyId = relPath.includes('surveys/') ? relPath.split('surveys/')[1].split('/')[0] : null;

      manifest.push({
        image_id: path.basename(entry.name, path.extname(entry.name)),
        original_filename: entry.name,
        sha256,
        size_bytes: stat.size,
        width: dims.width,
        height: dims.height,
        format: dims.format,
        dataset_split: split,
        class: className || 'unclassified',
        annotations: annotations.map(a => ({
          className: a.className,
          classId: a.classId,
          bbox_normalized: [a.x_center, a.y_center, a.width, a.height]
        })),
        coordinates: null,
        timestamp: stat.mtime.toISOString(),
        survey_id: surveyId,
        source: defaultSource || 'MarineVision-AI',
        relative_path: relPath,
        canonical_path: canonicalPath,
        is_duplicate: isDuplicate
      });
    }
  }
}

console.log('Generating IMAGE_MANIFEST.json...');
processDirectory('datasets', 'dataset', 'YOLO26x Dataset');
processDirectory('backend/sonar-storage', 'storage', 'Sonar Storage');
processDirectory('ml', 'ml', 'ML Raw / Processed');

fs.writeFileSync('IMAGE_MANIFEST.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log(`IMAGE_MANIFEST.json written with ${manifest.length} image records (${seenHashes.size} unique hashes).`);
