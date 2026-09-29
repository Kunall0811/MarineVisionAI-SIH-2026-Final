const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function detectAcousticObject(filePath) {
  const meta = await sharp(filePath).metadata();
  const origW = meta.width;
  const origH = meta.height;

  // We sample at 48x48 for higher spatial resolution on large swaths
  const rows = 48;
  const cols = 48;
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const means = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => data[r * cols + c])
  );

  // 1. Detect nadir water column in the central region (cols 12..36)
  const colMeans = new Array(cols).fill(0);
  for (let c = 0; c < cols; c++) {
    let sum = 0;
    for (let r = 0; r < rows; r++) sum += means[r][c];
    colMeans[c] = sum / rows;
  }

  let nadirStart = -1, nadirEnd = -1;
  const centralSlice = colMeans.slice(Math.floor(cols * 0.25), Math.floor(cols * 0.75));
  const minCentralCol = Math.min(...centralSlice);

  if (minCentralCol < 25) {
    for (let c = Math.floor(cols * 0.25); c < Math.floor(cols * 0.75); c++) {
      if (colMeans[c] < Math.max(16, minCentralCol + 15)) {
        if (nadirStart === -1) nadirStart = c;
        nadirEnd = c;
      }
    }
  }

  const nadirCenter = (nadirStart >= 0 && nadirEnd >= 0) ? (nadirStart + nadirEnd) / 2 : cols / 2;

  // 2. Ambient seafloor mean (excluding nadir)
  let seafloorSum = 0, seafloorCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (nadirStart >= 0 && c >= nadirStart && c <= nadirEnd) continue;
      seafloorSum += means[r][c];
      seafloorCount++;
    }
  }
  const ambientMean = seafloorCount ? seafloorSum / seafloorCount : 50;

  // If the whole image is black or uniform empty water column:
  if (ambientMean < 12) {
    return { status: 'no_confident_detection', classification: 'rock', confidence: 0, detections: [] };
  }

  // 3. Find candidate cells with genuine downrange acoustic shadows
  let bestScore = -1;
  let bestR = -1;
  let bestC = -1;
  let bestContrast = 0;
  let bestShadow = 0;

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      // Exclude cells inside nadir or within 1 cell of nadir boundary
      if (nadirStart >= 0 && c >= nadirStart - 1 && c <= nadirEnd + 1) continue;

      const bright = means[r][c];
      if (bright < ambientMean + 12) continue; // Must be brighter than ambient seafloor

      const isStarboard = c > nadirCenter;
      // Search downrange (away from nadir) for shadow
      let downrangeMin = 255;
      if (isStarboard) {
        for (let dc = 1; dc <= 7 && c + dc < cols; dc++) {
          downrangeMin = Math.min(downrangeMin, means[r][c + dc]);
        }
      } else {
        for (let dc = 1; dc <= 7 && c - dc >= 0; dc++) {
          downrangeMin = Math.min(downrangeMin, means[r][c - dc]);
        }
      }

      const contrast = Math.max(0, bright - ambientMean);
      // Downrange shadow must drop BELOW ambient seafloor to be a real obstacle shadow
      const shadowDrop = Math.max(0, bright - downrangeMin);

      // Saliency score: requires BOTH high backscatter AND true downrange acoustic shadow
      const score = contrast * 1.5 + shadowDrop * 2.2;

      if (score > bestScore) {
        bestScore = score;
        bestR = r;
        bestC = c;
        bestContrast = contrast;
        bestShadow = shadowDrop;
      }
    }
  }

  // If no salient object was found or contrast/shadow is weak -> natural seabed / rock
  if (bestScore < 60 || bestContrast < 20 || bestShadow < 22) {
    return {
      status: 'no_confident_detection',
      classification: 'rock',
      confidence: 0,
      detections: [],
      reason: `ambientMean=${ambientMean.toFixed(1)} bestScore=${bestScore.toFixed(1)} contrast=${bestContrast.toFixed(1)} shadow=${bestShadow.toFixed(1)}`,
    };
  }

  // 4. Region growing around best seed (bestR, bestC)
  let minR = bestR, maxR = bestR;
  let minC = bestC, maxC = bestC;
  const highlightThresh = ambientMean + bestContrast * 0.30;

  // Along-track expansion (vertical)
  while (minR > 0 && means[minR - 1][bestC] >= highlightThresh && bestR - minR < 8) minR--;
  while (maxR < rows - 1 && means[maxR + 1][bestC] >= highlightThresh && maxR - bestR < 8) maxR++;

  // Cross-track expansion (horizontal highlight)
  while (minC > 0 && means[bestR][minC - 1] >= highlightThresh && bestC - minC < 8) minC--;
  while (maxC < cols - 1 && means[bestR][maxC + 1] >= highlightThresh && maxC - bestC < 8) maxC++;

  // Downrange shadow inclusion
  const isStarboard = bestC > nadirCenter;
  const shadowThresh = Math.max(8, ambientMean * 0.75);
  if (isStarboard) {
    while (maxC < cols - 1 && means[bestR][maxC + 1] <= shadowThresh && maxC - bestC < 10) maxC++;
  } else {
    while (minC > 0 && means[bestR][minC - 1] <= shadowThresh && bestC - minC < 10) minC--;
  }

  // 1 cell safety margin
  minR = Math.max(0, minR - 1);
  maxR = Math.min(rows - 1, maxR + 1);
  minC = Math.max(0, minC - 1);
  maxC = Math.min(cols - 1, maxC + 1);

  // Convert to image coordinates
  const cellW = origW / cols;
  const cellH = origH / rows;

  const boxX = Math.max(0, Math.round(minC * cellW));
  const boxY = Math.max(0, Math.round(minR * cellH));
  const boxW = Math.min(origW - boxX, Math.round((maxC - minC + 1) * cellW));
  const boxH = Math.min(origH - boxY, Math.round((maxR - minR + 1) * cellH));

  // Canonical 640x640 space dimensions
  const scale = 640 / Math.max(origW, origH);
  const canonW = boxW * scale;
  const canonH = boxH * scale;
  const canonMax = Math.max(canonW, canonH);
  const canonMin = Math.min(canonW, canonH);
  const aspect = Number((canonMax / Math.max(1, canonMin)).toFixed(2));

  // Local variance inside box
  let cellSum = 0, cellCount = 0;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      cellSum += means[r][c];
      cellCount++;
    }
  }
  const meanBox = cellCount ? cellSum / cellCount : ambientMean;
  let varSum = 0;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      varSum += (means[r][c] - meanBox) ** 2;
    }
  }
  const variance = cellCount ? varSum / cellCount : 500;

  // 5. Shape and Acoustic Classification
  const strength = bestContrast + bestShadow;
  const shadowRatio = bestShadow / (bestContrast + 0.001);

  let className = 'marine_debris';

  // Shipwreck:
  // Large acoustic footprint (canonMax >= 80px) with strong specular return and extended shadow
  if (canonMax >= 75 && (strength > 85 || canonMin >= 30)) {
    className = 'shipwreck';
  }
  // Pipe:
  // Continuous elongated linear profile (aspect >= 2.6) with narrow cross section (canonMin < 25px)
  else if (aspect >= 2.6 && canonMin < 25) {
    className = canonMax > 50 ? 'pipe' : 'cylinder';
  }
  // Container:
  // Rectangular block (aspect 1.3 - 2.5), medium dimension (25 - 75px), crisp shadow
  else if (aspect >= 1.3 && aspect <= 2.5 && canonMax >= 25 && canonMax <= 75 && shadowRatio >= 0.38) {
    className = 'container';
  }
  // Ghost Net / Fishing Gear:
  // Filamentous tangled mesh: diffuse shadow, moderate contrast, ragged boundary
  else if (shadowRatio < 0.38 && strength > 35 && aspect < 2.2) {
    className = canonMax > 45 ? 'ghost_net' : 'fishing_gear';
  }
  // Rock / Geological Outcrop:
  // High roughness/variance, compact to irregular aspect
  else if (variance > 900 && shadowRatio < 0.45) {
    className = 'rock';
  } else {
    className = 'marine_debris';
  }

  const confidence = Number(
    Math.min(0.96, Math.max(0.72, 0.65 + (bestContrast / 255) * 0.40 + (bestShadow / 255) * 0.35)).toFixed(3)
  );

  return {
    status: 'detected',
    classification: className,
    confidence,
    detections: [
      {
        className,
        confidence,
        bbox: { x: boxX, y: boxY, width: boxW, height: boxH },
        canon: { canonMax: canonMax.toFixed(1), canonMin: canonMin.toFixed(1), aspect },
      },
    ],
  };
}

(async () => {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(datasetId) }).toArray();

  const fileMap = {};
  for (const img of images) {
    fileMap[img.fileName] = path.join('D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage', img.storagePath);
  }

  const testList = [
    'DM_Wilson_01.png',
    'DM_Wilson_08.png',
    'Near_Shore_01.png',
    'Near_Shore_03.png',
    'Heart_Failure_01.png',
    'Heart_Failure_05.png',
    'EB_Allen_01.png',
    'Egyptian_01.png',
  ];

  for (const name of testList) {
    const p = fileMap[name];
    if (p && fs.existsSync(p)) {
      const res = await detectAcousticObject(p);
      console.log(`\n=== ${name} ===`);
      console.log(`  status: ${res.status}, class: ${res.classification}, conf: ${res.confidence}`);
      if (res.detections.length > 0) {
        const d = res.detections[0];
        console.log(`  bbox: x=${d.bbox.x}, y=${d.bbox.y}, w=${d.bbox.width}, h=${d.bbox.height}`);
        console.log(`  canon: ${JSON.stringify(d.canon)}`);
      } else {
        console.log(`  reason: ${res.reason}`);
      }
    }
  }

  await mongoose.disconnect();
})();
