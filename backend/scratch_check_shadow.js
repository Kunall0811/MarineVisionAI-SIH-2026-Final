const sharp = require('sharp');

async function checkShadow() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const { data } = await sharp(file)
    .grayscale()
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log('Cols 40..60 (rows 0..10):');
  for (let r = 0; r < 10; r++) {
    let rowStr = `r=${r}: `;
    for (let c = 40; c < 60; c++) {
      rowStr += String(data[r * 64 + c]).padStart(4);
    }
    console.log(rowStr);
  }
}

checkShadow().catch(console.error);
