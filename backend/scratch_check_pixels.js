const sharp = require('sharp');

async function checkTopRight() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const N = 64;
  const { data } = await sharp(file)
    .grayscale()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log('Top right (r=0..12, c=40..60):');
  for (let r = 0; r < 12; r++) {
    let row = `r=${r}: `;
    for (let c = 40; c < 56; c++) {
      row += String(data[r * N + c]).padStart(4);
    }
    console.log(row);
  }

  // And let's check what is at r=32 (middle of the image, y ~ 2800)
  console.log('\nMiddle (r=30..35, c=15..30):');
  for (let r = 30; r < 35; r++) {
    let row = `r=${r}: `;
    for (let c = 15; c < 30; c++) {
      row += String(data[r * N + c]).padStart(4);
    }
    console.log(row);
  }
}

checkTopRight().catch(console.error);
