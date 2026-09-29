const sharp = require('sharp');

async function testConnectedObject(file) {
  const meta = await sharp(file).metadata();
  const origW = meta.width;
  const origH = meta.height;
  const rows = 48;
  const cols = 48;

  const { data } = await sharp(file)
    .grayscale()
    .resize(cols, rows, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const means = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => data[r * cols + c])
  );

  // 1. Detect nadir water column in central 50%
  const colMeans = new Array(cols).fill(0);
  for (let c = 0; c < cols; c++) {
    let s = 0;
    for (let r = 0; r < rows; r++) s += means[r][c];
    colMeans[c] = s / rows;
  }

  let nadirStart = -1, nadirEnd = -1;
  const minColVal = Math.min(...colMeans.slice(Math.floor(cols * 0.25), Math.floor(cols * 0.75)));
  if (minColVal < 25) {
    for (let c = Math.floor(cols * 0.25); c < Math.floor(cols * 0.75); c++) {
      if (colMeans[c] < Math.max(16, minColVal + 15)) {
        if (nadirStart === -1) nadirStart = c;
        nadirEnd = c;
      }
    }
  }

  const nadirCenter = (nadirStart >= 0 && nadirEnd >= 0) ? (nadirStart + nadirEnd) / 2 : cols / 2;

  // 2. Compute ambient seafloor (excluding nadir)
  let seafloorSum = 0, seafloorCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (nadirStart >= 0 && c >= nadirStart && c <= nadirEnd) continue;
      seafloorSum += means[r][c];
      seafloorCount++;
    }
  }
  const ambientMean = seafloorCount ? seafloorSum / seafloorCount : 60;

  console.log(`File: ${file.split(/[\\/]/).pop()} (${origW}x${origH})`);
  console.log(`Nadir: cols ${nadirStart}..${nadirEnd}, ambient: ${ambientMean.toFixed(1)}`);

  // 3. For every cell, find downrange acoustic shadow (away from nadir)
  // And score objectness:
  // A true object has:
  // - High brightness above ambient
  // - Downrange shadow: cell drops sharply within 1..5 cells downrange
  // - Along-track compact extent (not a continuous vertical bank)
  let bestScore = -1;
  let bestR = -1;
  let bestC = -1;
  let bestContrast = 0;
  let bestShadow = 0;

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      // Exclude nadir and first 2 cells bordering nadir
      if (nadirStart >= 0 && c >= nadirStart - 2 && c <= nadirEnd + 2) continue;

      const bright = means[r][c];
      if (bright < ambientMean + 15) continue;

      const isStarboard = c > nadirCenter;
      let minDownrange = 255;
      if (isStarboard) {
        for (let dc = 1; dc <= 6 && c + dc < cols; dc++) {
          minDownrange = Math.min(minDownrange, means[r][c + dc]);
        }
      } else {
        for (let dc = 1; dc <= 6 && c - dc >= 0; dc++) {
          minDownrange = Math.min(minDownrange, means[r][c - dc]);
        }
      }

      const contrast = bright - ambientMean;
      const shadowDrop = Math.max(0, bright - minDownrange);

      // Check along-track continuity: penalize if it's part of a vertical stripe spanning >15 rows
      let vertSpan = 1;
      let up = r - 1;
      while (up >= 0 && means[up][c] > ambientMean + 15) { vertSpan++; up--; }
      let down = r + 1;
      while (down < rows && means[down][c] > ambientMean + 15) { vertSpan++; down++; }

      // Discrete objects have vertSpan <= 10. Long sand banks/nadir ridges have vertSpan > 15
      const continuityPenalty = vertSpan > 12 ? Math.max(0.2, 1 - (vertSpan - 12) * 0.08) : 1.0;

      const score = (contrast * 1.6 + shadowDrop * 2.2) * continuityPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestR = r;
        bestC = c;
        bestContrast = contrast;
        bestShadow = shadowDrop;
      }
    }
  }

  console.log(`Best seed: [r=${bestR}, c=${bestC}] score=${bestScore.toFixed(1)} contrast=${bestContrast.toFixed(1)} shadow=${bestShadow.toFixed(1)}`);
  console.log(`Seed coordinates: x=${Math.round(bestC * origW / cols)}, y=${Math.round(bestR * origH / rows)}`);

  // 4. Region growing
  let minR = bestR, maxR = bestR;
  let minC = bestC, maxC = bestC;
  const highlightThresh = ambientMean + bestContrast * 0.25;

  // 2D BFS / Flood fill for the highlight cluster
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const queue = [[bestR, bestC]];
  visited[bestR][bestC] = true;

  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    minR = Math.min(minR, cr);
    maxR = Math.max(maxR, cr);
    minC = Math.min(minC, cc);
    maxC = Math.max(maxC, cc);

    const neighbors = [
      [cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1],
      [cr - 1, cc - 1], [cr - 1, cc + 1], [cr + 1, cc - 1], [cr + 1, cc + 1]
    ];
    for (const [nr, nc] of neighbors) {
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        // Don't expand into nadir
        if (nadirStart >= 0 && nc >= nadirStart - 1 && nc <= nadirEnd + 1) continue;
        if (means[nr][nc] >= highlightThresh) {
          visited[nr][nc] = true;
          // Limit cluster radius
          if (Math.abs(nr - bestR) <= 8 && Math.abs(nc - bestC) <= 8) {
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  // Include acoustic shadow DOWNRANGE (away from nadir)
  const isStarboard = bestC > nadirCenter;
  const shadowThresh = Math.max(10, ambientMean * 0.8);
  if (isStarboard) {
    while (maxC < cols - 1 && means[bestR][maxC + 1] <= shadowThresh && maxC - bestC < 10) {
      maxC++;
    }
  } else {
    while (minC > 0 && means[bestR][minC - 1] <= shadowThresh && bestC - minC < 10) {
      minC--;
    }
  }

  // Add 1 cell margin
  minR = Math.max(0, minR - 1);
  maxR = Math.min(rows - 1, maxR + 1);
  minC = Math.max(0, minC - 1);
  maxC = Math.min(cols - 1, maxC + 1);

  const cellW = origW / cols;
  const cellH = origH / rows;

  const boxX = Math.round(minC * cellW);
  const boxY = Math.round(minR * cellH);
  const boxW = Math.round((maxC - minC + 1) * cellW);
  const boxH = Math.round((maxR - minR + 1) * cellH);

  console.log(`Bounding Box: x=${boxX} (${(boxX/origW*100).toFixed(1)}%), y=${boxY} (${(boxY/origH*100).toFixed(1)}%), w=${boxW}, h=${boxH}`);
}

(async () => {
  await testConnectedObject('D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png');
  console.log('\n---');
  await testConnectedObject('D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_08.png');
})();
