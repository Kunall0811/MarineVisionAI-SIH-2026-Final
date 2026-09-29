const sharp = require('sharp');

async function traceWilson01() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const meta = await sharp(file).metadata();
  const rows = 32;
  const cols = 32;

  const { data } = await sharp(file)
    .grayscale()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const means = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => data[r * cols + c])
  );
  const globalMean = means.flat().reduce((a, b) => a + b, 0) / (rows * cols || 1);

  // Print grid
  console.log(`Global mean: ${globalMean.toFixed(1)}`);

  // Let's compute scores for all cells and print top 10
  const scores = [];
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

      scores.push({
        r, c,
        x: Math.round(c * meta.width / cols),
        y: Math.round(r * meta.height / rows),
        bright,
        left, right, top, bottom, minNeighbor,
        contrast: Number(contrast.toFixed(1)),
        shadowDrop: Number(shadowDrop.toFixed(1)),
        score: Number(score.toFixed(1)),
      });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  console.log('\nTop 10 highest scoring cells in current algorithm:');
  for (let i = 0; i < 10; i++) {
    const s = scores[i];
    console.log(`  #${i+1}: [r=${s.r}, c=${s.c}] -> (x=${s.x}, y=${s.y}) score=${s.score} bright=${s.bright} contrast=${s.contrast} shadow=${s.shadowDrop} (L=${s.left}, R=${s.right}, T=${s.top}, B=${s.bottom})`);
  }

  // Now let's see where the SHIP is (r around 0..4, c around 20..26)
  console.log('\nScores at the ship location (r=1..4, c=20..26):');
  for (const s of scores) {
    if (s.r >= 1 && s.r <= 4 && s.c >= 20 && s.c <= 26) {
      console.log(`  Ship cell [r=${s.r}, c=${s.c}] -> (x=${s.x}, y=${s.y}) score=${s.score} bright=${s.bright} contrast=${s.contrast} shadow=${s.shadowDrop} (L=${s.left}, R=${s.right})`);
    }
  }
}

traceWilson01().catch(console.error);
