const sharp = require('sharp');

async function checkColMeans() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const { data } = await sharp(file)
    .grayscale()
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colMeans = new Array(32).fill(0);
  for (let c = 0; c < 32; c++) {
    let sum = 0;
    for (let r = 0; r < 32; r++) {
      sum += data[r * 32 + c];
    }
    colMeans[c] = sum / 32;
    console.log(`c=${String(c).padStart(2)}: mean=${colMeans[c].toFixed(1)}`);
  }
}

checkColMeans().catch(console.error);
