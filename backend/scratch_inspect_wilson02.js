const sharp = require('sharp');

async function inspectWilson02() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_02.png';
  const meta = await sharp(file).metadata();
  console.log(`DM_Wilson_02: ${meta.width}x${meta.height}`);

  // In Screenshot 2, the ship is at the top right!
  // Let's crop x: 800..1500, y: 0..1200 and save as crop_wilson02_ship.png
  await sharp(file)
    .extract({ left: 800, top: 0, width: 700, height: 1200 })
    .toFile('crop_wilson02_ship.png');

  console.log('Saved crop_wilson02_ship.png');
}

inspectWilson02().catch(console.error);
