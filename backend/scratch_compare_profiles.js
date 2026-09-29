const sharp = require('sharp');

async function compareShipVsSand() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const N = 48;
  const { data } = await sharp(file)
    .grayscale()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log('--- 1. SHIP PROFILE (rows 2..7, cols 28..45) ---');
  for (let r = 2; r <= 7; r++) {
    let row = `r=${r}: `;
    for (let c = 28; c <= 45; c++) {
      row += String(data[r * N + c]).padStart(4);
    }
    console.log(row);
  }

  console.log('\n--- 2. SAND BANK PROFILE (rows 38..43, cols 28..45) ---');
  for (let r = 38; r <= 43; r++) {
    let row = `r=${r}: `;
    for (let c = 28; c <= 45; c++) {
      row += String(data[r * N + c]).padStart(4);
    }
    console.log(row);
  }
}

compareShipVsSand().catch(console.error);
