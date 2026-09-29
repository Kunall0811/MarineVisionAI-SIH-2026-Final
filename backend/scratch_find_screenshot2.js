const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function scanImages() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  console.log(`Total png files: ${files.length}`);

  // For each file, check top right region (row 0..10, col 16..31) for bright object
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(dir, file);
    const { data, info } = await sharp(fullPath)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // In Screenshot 2:
    // Center column ~10..14 is very dark (nadir).
    // Top right ~ r: 2..8, c: 16..25 has a bright object (the slanted wreck).
    // Bottom near nadir ~ r: 20..31, c: 12..16 is bright (bottom reflection).
    let nadirDarkness = 0;
    for (let r = 5; r < 28; r++) {
      nadirDarkness += data[r * 32 + 10] + data[r * 32 + 11];
    }
    nadirDarkness /= (23 * 2);

    let topRightBright = 0;
    for (let r = 2; r < 8; r++) {
      for (let c = 16; c < 26; c++) {
        topRightBright = Math.max(topRightBright, data[r * 32 + c]);
      }
    }

    let botNadirBright = 0;
    for (let r = 22; r < 30; r++) {
      for (let c = 12; c < 16; c++) {
        botNadirBright = Math.max(botNadirBright, data[r * 32 + c]);
      }
    }

    if (nadirDarkness < 15 && topRightBright > 110 && botNadirBright > 150) {
      console.log(`Potential MATCH: ${file} (nadirDarkness=${nadirDarkness.toFixed(1)}, topRight=${topRightBright}, botNadir=${botNadirBright})`);
    }
  }
}

scanImages().catch(console.error);
