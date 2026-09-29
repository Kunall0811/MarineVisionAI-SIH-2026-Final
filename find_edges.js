const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function findStructuralFeatures() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const meta = await sharp(p).metadata();
  const W = meta.width;
  const H = meta.height;

  // Downsample to a manageable size: 120 x 180
  const dw = 120;
  const dh = Math.round(120 * H / W); // ~193
  const { data } = await sharp(p)
    .grayscale()
    .resize(dw, dh, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute gradient energy (Sobel-like |dx| + |dy|) for each cell
  const energy = Array.from({ length: dh }, () => new Array(dw).fill(0));
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const dx = Math.abs(data[y * dw + (x + 1)] - data[y * dw + (x - 1)]);
      const dy = Math.abs(data[(y + 1) * dw + x] - data[(y - 1) * dw + x]);
      const val = data[y * dw + x];
      // Structural anomaly is high intensity + high local edge contrast
      energy[y][x] = (dx + dy) * (val > 30 ? 1.5 : 0.5) + val * 0.8;
    }
  }

  // Print energy in 10 vertical segments from top to bottom
  const segH = Math.floor(dh / 10);
  console.log(`Grid ${dw}x${dh}. Vertical energy profile (0 = top, 9 = bottom):`);
  for (let s = 0; s < 10; s++) {
    let segSum = 0;
    let segMax = 0;
    for (let y = s * segH; y < (s + 1) * segH; y++) {
      for (let x = 0; x < dw; x++) {
        const e = energy[y][x];
        segSum += e;
        if (e > segMax) segMax = e;
      }
    }
    const avg = segSum / (segH * dw);
    console.log(`Segment ${s} (y=${Math.round(s * segH * H / dh)}..${Math.round((s + 1) * segH * H / dh)}): avgEnergy=${avg.toFixed(1)}, max=${segMax.toFixed(1)}`);
  }
}
findStructuralFeatures();
