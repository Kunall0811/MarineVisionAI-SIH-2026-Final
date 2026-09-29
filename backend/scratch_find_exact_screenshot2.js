const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function findExactScreenshot2Image() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

  // Also check ml/dataset/raw
  const rawDir = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw';
  const rawFiles = fs.readdirSync(rawDir).filter(f => f.endsWith('.png'));

  const allFiles = [
    ...rawFiles.map(f => ({ name: f, path: path.join(rawDir, f) })),
    ...files.map(f => ({ name: f, path: path.join(dir, f) }))
  ];

  console.log(`Checking ${allFiles.length} files...`);

  for (const item of allFiles) {
    const meta = await sharp(item.path).metadata();
    // In Screenshot 2:
    // Aspect ratio: width is ~1728 or similar, but the ship is at top right.
    // Let's sample at 32x32:
    const { data } = await sharp(item.path)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Look at Screenshot 2:
    // Left side (c: 0..8): medium gray seabed (values ~ 80..130)
    // Nadir (c: 9..12): pitch black (values ~ 0..5)
    // Top right (r: 1..5, c: 14..22): ship! High brightness (values > 140)
    // Above or to the right of the ship (r: 1..5, c: 23..31): deep black acoustic shadow! (values < 15)
    // Below the ship in the middle: medium gray seabed.
    let leftMean = 0;
    for (let r = 5; r < 25; r++) {
      for (let c = 1; c < 7; c++) leftMean += data[r * 32 + c];
    }
    leftMean /= (20 * 6);

    let nadirMean = 0;
    for (let r = 5; r < 25; r++) {
      for (let c = 9; c <= 11; c++) nadirMean += data[r * 32 + c];
    }
    nadirMean /= (20 * 3);

    let shipBrightness = 0;
    for (let r = 1; r <= 6; r++) {
      for (let c = 14; c <= 20; c++) {
        shipBrightness = Math.max(shipBrightness, data[r * 32 + c]);
      }
    }

    let shipShadowDarkness = 255;
    for (let r = 1; r <= 6; r++) {
      for (let c = 22; c <= 28; c++) {
        shipShadowDarkness = Math.min(shipShadowDarkness, data[r * 32 + c]);
      }
    }

    if (leftMean > 60 && nadirMean < 10 && shipBrightness > 150 && shipShadowDarkness < 30) {
      console.log(`MATCH FOUND: ${item.name} (${meta.width}x${meta.height}) at ${item.path}`);
      console.log(`  leftMean=${leftMean.toFixed(1)}, nadirMean=${nadirMean.toFixed(1)}, shipBright=${shipBrightness}, shadowDark=${shipShadowDarkness}`);
    }
  }
}

findExactScreenshot2Image().catch(console.error);
