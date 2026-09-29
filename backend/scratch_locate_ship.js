const sharp = require('sharp');

async function locateShipIn01() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const meta = await sharp(file).metadata();

  // In DM_Wilson_01, let's analyze the image at 128x128 resolution
  const N = 128;
  const { data } = await sharp(file)
    .grayscale()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 1. Detect vertical nadir column range:
  const colMeans = new Array(N).fill(0);
  for (let c = 0; c < N; c++) {
    let s = 0;
    for (let r = 0; r < N; r++) s += data[r * N + c];
    colMeans[c] = s / N;
  }

  let nadirStart = -1, nadirEnd = -1;
  const minC = Math.min(...colMeans.slice(Math.floor(N * 0.25), Math.floor(N * 0.75)));
  for (let c = Math.floor(N * 0.25); c < Math.floor(N * 0.75); c++) {
    if (colMeans[c] < Math.max(16, minC + 15)) {
      if (nadirStart === -1) nadirStart = c;
      nadirEnd = c;
    }
  }
  console.log(`Nadir detected: cols ${nadirStart}..${nadirEnd} (x = ${Math.round(nadirStart * meta.width / N)}..${Math.round(nadirEnd * meta.width / N)})`);

  // 2. Compute local standard deviation / high-frequency texture (sobel / gradient)
  // Natural sediment or sandy seafloor has low gradient / smooth intensity.
  // Man-made structures (shipwreck, container, pipe, nets) have SHARP gradient and high local variance!
  const grad = new Float32Array(N * N);
  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      // Exclude nadir water column and its immediate boundary
      if (nadirStart >= 0 && c >= nadirStart - 2 && c <= nadirEnd + 2) continue;

      const gx = data[r * N + c + 1] - data[r * N + c - 1];
      const gy = data[(r + 1) * N + c] - data[(r - 1) * N + c];
      const g = Math.sqrt(gx * gx + gy * gy);
      grad[r * N + c] = g;
    }
  }

  // Find peak gradient / structure
  let maxG = 0, bestR = 0, bestC = 0;
  for (let r = 1; r < N - 1; r++) {
    for (let c = 1; c < N - 1; c++) {
      if (grad[r * N + c] > maxG) {
        maxG = grad[r * N + c];
        bestR = r;
        bestC = c;
      }
    }
  }

  console.log(`Peak gradient: ${maxG.toFixed(1)} at [r=${bestR}, c=${bestC}] -> (x=${Math.round(bestC * meta.width / N)}, y=${Math.round(bestR * meta.height / N)})`);
  console.log(`Pixel intensity at peak: ${data[bestR * N + bestC]}`);
}

locateShipIn01().catch(console.error);
