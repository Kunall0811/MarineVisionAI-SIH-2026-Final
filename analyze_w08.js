const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function analyzeWilson08() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;

  console.log(`Image: ${w}x${h}, channels: ${ch}`);

  // Analyze 20 vertical bands from top (y=0) to bottom (y=h)
  const numBands = 20;
  const bandH = Math.floor(h / numBands);

  console.log('\nVertical bands (0 = top, 19 = bottom):');
  for (let b = 0; b < numBands; b++) {
    const yStart = b * bandH;
    const yEnd = (b + 1) * bandH;
    let sum = 0;
    let max = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const val = data[(y * w + x) * ch];
        sum += val;
        if (val > max) max = val;
        count++;
      }
    }
    const mean = sum / count;
    console.log(`Band ${b} (y=${yStart}..${yEnd}): mean=${mean.toFixed(1)}, max=${max}`);
  }
}
analyzeWilson08();
