const sharp = require('sharp');

async function inspectCrops() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  
  // Crop 1: Top right (y: 0..800)
  await sharp(file)
    .extract({ left: 900, top: 0, width: 700, height: 1000 })
    .toFile('crop_top_right.png');

  // Crop 2: Middle (y: 1800..2600)
  await sharp(file)
    .extract({ left: 900, top: 1800, width: 700, height: 1000 })
    .toFile('crop_middle.png');

  console.log('Saved crop_top_right.png and crop_middle.png');
}

inspectCrops().catch(console.error);
