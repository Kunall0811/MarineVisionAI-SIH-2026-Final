const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function findWhichDmWilson() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw';
  const files = fs.readdirSync(dir).filter(f => f.startsWith('DM_Wilson_') && f.endsWith('.png'));

  for (const f of files) {
    const fullPath = path.join(dir, f);
    // In Screenshot 2, the image aspect ratio is tall (around 1728x5579),
    // and at top right (x around 800..1200, y around 0..1000) there is high variance / contrast.
    // Let's sample a 64x64 grid
    const { data } = await sharp(fullPath)
      .resize(64, 64, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Center nadir in 64x64: around col 28..35
    let nadirSum = 0;
    for (let r = 10; r < 50; r++) {
      for (let c = 29; c <= 33; c++) {
        nadirSum += data[r * 64 + c];
      }
    }
    const nadirMean = nadirSum / (40 * 5);

    // Top right: r 2..15, c 35..55
    let topMax = 0;
    let topVarSum = 0;
    let count = 0;
    for (let r = 2; r < 12; r++) {
      for (let c = 35; c < 50; c++) {
        const val = data[r * 64 + c];
        topMax = Math.max(topMax, val);
        topVarSum += val;
        count++;
      }
    }
    const topMean = topVarSum / count;

    console.log(`${f}: nadirMean=${nadirMean.toFixed(1)} topMax=${topMax} topMean=${topMean.toFixed(1)}`);
  }
}

findWhichDmWilson().catch(console.error);
