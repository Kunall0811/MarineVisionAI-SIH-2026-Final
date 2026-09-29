const sharp = require('sharp');

async function inspectWilson01() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const meta = await sharp(file).metadata();
  console.log(`DM_Wilson_01: ${meta.width}x${meta.height}`);

  // In DM_Wilson_01 (1728x5579), where is the ship?
  // Let's inspect downsampled 64x64 or 128x128
  const { data } = await sharp(file)
    .grayscale()
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Let's find rows 0..20, cols 32..64
  console.log('Top right region (rows 0..15, cols 32..64):');
  for (let r = 0; r < 12; r++) {
    let rowStr = `r=${String(r).padStart(2)}: `;
    for (let c = 32; c < 50; c += 2) {
      rowStr += String(data[r * 64 + c]).padStart(4);
    }
    console.log(rowStr);
  }

  // And let's check column means across the image to find the nadir track:
  const colMeans = new Array(64).fill(0);
  for (let c = 0; c < 64; c++) {
    let sum = 0;
    for (let r = 0; r < 64; r++) {
      sum += data[r * 64 + c];
    }
    colMeans[c] = (sum / 64).toFixed(1);
  }
  console.log('\nColumn means (cols 24..40, around center):');
  for (let c = 24; c < 40; c++) {
    console.log(`  col ${c} (x ~ ${Math.round(c * 1728 / 64)}px): mean = ${colMeans[c]}`);
  }
}

inspectWilson01().catch(console.error);
