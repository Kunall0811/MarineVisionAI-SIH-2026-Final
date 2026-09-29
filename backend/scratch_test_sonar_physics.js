const sharp = require('sharp');

async function testSonarPhysics(file) {
  const meta = await sharp(file).metadata();
  const origW = meta.width;
  const origH = meta.height;
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

  // 1. Compute column vertical means to detect nadir water column
  const colMeans = new Array(cols).fill(0);
  for (let c = 0; c < cols; c++) {
    let sum = 0;
    for (let r = 0; r < rows; r++) sum += means[r][c];
    colMeans[c] = sum / rows;
  }

  // Find nadir: central region columns where colMean < 18 or significantly low
  let nadirStart = -1, nadirEnd = -1;
  const minCol = Math.min(...colMeans.slice(8, 24));
  if (minCol < 25) {
    for (let c = 8; c < 24; c++) {
      if (colMeans[c] < Math.max(18, minCol + 15)) {
        if (nadirStart === -1) nadirStart = c;
        nadirEnd = c;
      }
    }
  }

  const nadirCenter = (nadirStart >= 0 && nadirEnd >= 0) ? (nadirStart + nadirEnd) / 2 : cols / 2;
  console.log(`File: ${file.split(/[\\/]/).pop()} (${origW}x${origH})`);
  console.log(`Nadir detected: start=${nadirStart}, end=${nadirEnd}, center=${nadirCenter.toFixed(1)}`);

  // Compute background seafloor (excluding nadir)
  let seafloorSum = 0, seafloorCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (nadirStart >= 0 && c >= nadirStart && c <= nadirEnd) continue;
      seafloorSum += means[r][c];
      seafloorCount++;
    }
  }
  const ambientSeafloor = seafloorCount ? seafloorSum / seafloorCount : 60;
  console.log(`Ambient seafloor mean: ${ambientSeafloor.toFixed(1)}`);

  // Now compute candidate scores
  const candidates = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Skip cells inside or immediately adjacent to nadir
      if (nadirStart >= 0 && c >= nadirStart - 1 && c <= nadirEnd + 1) continue;

      const bright = means[r][c];
      // Only evaluate cells brighter than local ambient
      if (bright <= ambientSeafloor + 15) continue;

      const isStarboard = c > nadirCenter;
      // Search downrange for the acoustic shadow
      let minDownrange = 255;
      if (isStarboard) {
        // Shadow is cast to the right
        for (let dc = 1; dc <= 6 && c + dc < cols; dc++) {
          minDownrange = Math.min(minDownrange, means[r][c + dc]);
        }
      } else {
        // Shadow is cast to the left
        for (let dc = 1; dc <= 6 && c - dc >= 0; dc++) {
          minDownrange = Math.min(minDownrange, means[r][c - dc]);
        }
      }

      const contrast = bright - ambientSeafloor;
      const shadowDrop = Math.max(0, bright - minDownrange);

      // Also compute local cross-track prominence (vertical difference along ping direction)
      const top = r > 0 ? means[r - 1][c] : bright;
      const bot = r < rows - 1 ? means[r + 1][c] : bright;
      const vertDrop = Math.max(0, bright - Math.min(top, bot));

      // A true acoustic anomaly has:
      // 1. High contrast above ambient
      // 2. Clear downrange acoustic shadow
      // 3. Vertical prominence (it stands out from surrounding pings)
      const score = contrast * 1.5 + shadowDrop * 2.0 + vertDrop * 0.8;

      candidates.push({
        r, c,
        x: Math.round(c * origW / cols),
        y: Math.round(r * origH / rows),
        bright,
        minDownrange,
        contrast: Number(contrast.toFixed(1)),
        shadowDrop: Number(shadowDrop.toFixed(1)),
        vertDrop: Number(vertDrop.toFixed(1)),
        score: Number(score.toFixed(1)),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  console.log('Top 5 candidates:');
  for (let i = 0; i < Math.min(5, candidates.length); i++) {
    const s = candidates[i];
    console.log(`  #${i+1}: [r=${s.r}, c=${s.c}] -> (x=${s.x}, y=${s.y}) score=${s.score} bright=${s.bright} shadow=${s.shadowDrop} downrangeMin=${s.minDownrange}`);
  }
}

(async () => {
  await testSonarPhysics('D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png');
  console.log('\n---');
  await testSonarPhysics('D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_08.png');
})();
