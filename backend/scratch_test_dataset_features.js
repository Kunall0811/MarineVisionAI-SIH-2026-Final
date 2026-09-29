const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Let's test the extractAcousticFeatureBox logic directly
async function testAcousticFeature(filePath) {
  const meta = await sharp(filePath).metadata();
  const origW = meta.width;
  const origH = meta.height;

  const rows = 32;
  const cols = 32;
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const means = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => data[r * cols + c])
  );

  const globalMean = means.flat().reduce((a, b) => a + b, 0) / (rows * cols || 1);

  let maxScore = -1;
  let bestR = 0;
  let bestC = 0;
  let bestContrast = 0;
  let bestShadow = 0;

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const bright = means[r][c];
      const left = means[r][c - 1];
      const right = means[r][c + 1];
      const top = means[r - 1][c];
      const bottom = means[r + 1][c];
      const minNeighbor = Math.min(left, right, top, bottom);

      const contrast = Math.max(0, bright - globalMean);
      const shadowDrop = Math.max(0, bright - minNeighbor);
      const score = contrast * 1.6 + shadowDrop * 2.2;

      if (score > maxScore) {
        maxScore = score;
        bestR = r;
        bestC = c;
        bestContrast = contrast;
        bestShadow = shadowDrop;
      }
    }
  }

  return {
    origW,
    origH,
    globalMean: globalMean.toFixed(1),
    bestR,
    bestC,
    bestCoordY: Math.round(bestR * (origH / rows)),
    bestCoordX: Math.round(bestC * (origW / cols)),
    bestContrast: bestContrast.toFixed(1),
    bestShadow: bestShadow.toFixed(1),
    maxScore: maxScore.toFixed(1),
  };
}

(async () => {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).slice(0, 10);

  for (const f of files) {
    const res = await testAcousticFeature(path.join(dir, f));
    console.log(`File: ${f} (${res.origW}x${res.origH})`);
    console.log(`  best: [r=${res.bestR}, c=${res.bestC}] -> (x=${res.bestCoordX}, y=${res.bestCoordY}) score=${res.maxScore} contrast=${res.bestContrast} shadow=${res.bestShadow} globalMean=${res.globalMean}`);
  }
})();
