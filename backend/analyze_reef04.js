const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function analyzeReef04() {
  const imgPath = path.join(__dirname, 'sonar-storage/surveys/training/6ab8e57793676dbff84e6a3d/2c10626fa1270eb2.png');
  const meta = await sharp(imgPath).metadata();
  console.log('Artificial_Reef_04 dims:', meta.width, 'x', meta.height);

  // Resize to 640x640
  const buf = await sharp(imgPath)
    .resize(640, 640, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Find all bright regions with shadow
  // Downsample to 40x40 grid (16px per cell)
  const G = 40;
  const S = 16;
  const grid = Array.from({ length: G }, () => new Float32Array(G));
  let totalMean = 0;

  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      let sum = 0;
      for (let y = r * S; y < (r + 1) * S; y++) {
        for (let x = c * S; x < (c + 1) * S; x++) {
          sum += buf[y * 640 + x];
        }
      }
      grid[r][c] = sum / (S * S);
      totalMean += grid[r][c];
    }
  }
  totalMean /= (G * G);
  console.log('Global mean intensity:', totalMean.toFixed(1));

  // Find cells with high contrast (bright) + adjacent shadow (dark)
  const candidates = [];
  for (let r = 1; r < G - 1; r++) {
    for (let c = 1; c < G - 1; c++) {
      const val = grid[r][c];
      if (val > totalMean + 40) {
        // Check for shadow horizontally or vertically
        const minAdj = Math.min(grid[r][c-1], grid[r][c+1], grid[r-1][c], grid[r+1][c]);
        candidates.push({ r, c, val: val.toFixed(0), drop: (val - minAdj).toFixed(0), x: c * S, y: r * S });
      }
    }
  }
  console.log(`Total highlight cells (> mean+40): ${candidates.length}`);
  // Sort by brightness * drop
  candidates.sort((a, b) => (b.val * b.drop) - (a.val * a.drop));
  console.log('Top 10 anomaly cells:');
  console.log(candidates.slice(0, 10));
}

analyzeReef04().catch(console.error);
