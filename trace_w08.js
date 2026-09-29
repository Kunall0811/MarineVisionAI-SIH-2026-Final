const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function tracePreprocessed() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const image = sharp(p).rotate();
  const processed = await image
    .grayscale()
    .median(3)
    .normalize()
    .resize(640, 640, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .toFormat('png')
    .toBuffer();

  const { data, info } = await sharp(processed).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const gridSize = 20;
  const cols = Math.floor(w / gridSize);
  const rows = Math.floor(h / gridSize);

  const means = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let y = r * gridSize; y < (r + 1) * gridSize; y++) {
        for (let x = c * gridSize; x < (c + 1) * gridSize; x++) {
          sum += data[y * w + x];
        }
      }
      means[r][c] = sum / (gridSize * gridSize);
    }
  }

  const globalMean = means.flat().reduce((a, b) => a + b, 0) / (rows * cols || 1);
  const midC = Math.floor(cols / 2);

  console.log(`Grid: ${cols}x${rows}, globalMean: ${globalMean.toFixed(1)}, midC: ${midC}`);

  // Find top 10 highest scoring cells
  const scores = [];
  for (let r = 2; r < rows - 3; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (Math.abs(c - midC) <= 2) continue;
      const bright = means[r][c];
      const shadowOffset = c < midC ? -1 : 1;
      const shadow1 = means[r][c + shadowOffset] ?? globalMean;
      const shadow2 = means[r][c + shadowOffset * 2] ?? globalMean;
      const shadowAvg = Math.min(shadow1, shadow2);

      const contrast = Math.max(0, bright - globalMean);
      const drop = Math.max(0, bright - shadowAvg);
      const score = contrast * 1.8 + drop * 2.6;
      scores.push({ r, c, bright: bright.toFixed(1), contrast: contrast.toFixed(1), drop: drop.toFixed(1), score: score.toFixed(1) });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  console.log('\nTop 10 scoring cells:');
  for (let i = 0; i < 10; i++) {
    console.log(`Rank ${i + 1}: r=${scores[i].r} (y~${scores[i].r * 20}), c=${scores[i].c} (x~${scores[i].c * 20}), score=${scores[i].score}, contrast=${scores[i].contrast}, drop=${scores[i].drop}, bright=${scores[i].bright}`);
  }

  // Also print where the brightest cells are
  const brightest = [...scores].sort((a, b) => b.bright - a.bright);
  console.log('\nTop 5 brightest cells:');
  for (let i = 0; i < 5; i++) {
    console.log(`Rank ${i + 1}: r=${brightest[i].r} (y~${brightest[i].r * 20}), c=${brightest[i].c} (x~${brightest[i].c * 20}), bright=${brightest[i].bright}`);
  }
}
tracePreprocessed();
