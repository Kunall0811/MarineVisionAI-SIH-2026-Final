const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function findExactMatch() {
  const target = 'C:/Users/SHARAD/.gemini/antigravity-ide/brain/78f6f18f-89ec-44f5-8855-634057077a12/.user_uploaded/media_1790451196707.png';
  const targetMeta = await sharp(target).metadata();
  console.log('Target screenshot size:', targetMeta.width, 'x', targetMeta.height);

  // In the target screenshot, the sonar viewport is on the left half (x from ~35 to ~595)
  // Let's crop the actual sonar image from the screenshot
  // In the screenshot: width=1033, height=581
  // Sonar image is roughly x: 35..595, y: 0..581
  const sonarCrop = await sharp(target)
    .extract({ left: 35, top: 0, width: 560, height: 546 })
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Now compare against all 141 files in dataset and 15 raw files
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

  let bestDiff = Infinity;
  let bestFile = '';

  for (const f of files) {
    const fullPath = path.join(dir, f);
    const buf = await sharp(fullPath)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    let diff = 0;
    for (let i = 0; i < 32 * 32; i++) {
      diff += Math.abs(sonarCrop[i] - buf[i]);
    }

    if (diff < bestDiff) {
      bestDiff = diff;
      bestFile = f;
    }
  }

  console.log(`Best match in dataset: ${bestFile} with diff = ${bestDiff}`);

  // Also check original fileName from DB for bestFile
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;
  const doc = await db.collection('ai_dataset_images').findOne({ storagePath: { $regex: bestFile } });
  console.log('Original fileName in DB:', doc ? doc.fileName : 'unknown');
  await mongoose.disconnect();
}

findExactMatch().catch(console.error);
