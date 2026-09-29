const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

async function findExactImages() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const dsId = new mongoose.Types.ObjectId('6ab8e57793676dbff84e6a3d');
  const images = await mongoose.connection.db.collection('ai_dataset_images').find({ datasetId: dsId }).toArray();
  console.log(`Searching 120 images...`);

  for (const img of images) {
    const fullPath = path.join(__dirname, 'sonar-storage', img.storagePath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const meta = await sharp(fullPath).metadata();
      // Screenshot 1: vertical, has two bright curved horns/pipes near top (y around 15%..25%) on left and right of nadir
      // Center column (x around 48%..52%) is black nadir
      // Left arc is bright around x: 20%..40%, y: 15%..25%
      // Right arc is bright around x: 60%..80%, y: 15%..25%
      const w = meta.width;
      const h = meta.height;
      if (h > w) {
        const topThird = await sharp(fullPath)
          .extract({ left: 0, top: Math.round(h * 0.1), width: w, height: Math.round(h * 0.25) })
          .resize(100, 100)
          .grayscale()
          .raw()
          .toBuffer();

        // Check if left (x: 20..45) has bright pixels > 200 AND right (x: 55..80) has bright pixels > 200
        let leftMax = 0, rightMax = 0, centerMin = 255;
        for (let y = 0; y < 100; y++) {
          for (let x = 20; x <= 45; x++) {
            if (topThird[y * 100 + x] > leftMax) leftMax = topThird[y * 100 + x];
          }
          for (let x = 55; x <= 80; x++) {
            if (topThird[y * 100 + x] > rightMax) rightMax = topThird[y * 100 + x];
          }
          for (let x = 48; x <= 52; x++) {
            if (topThird[y * 100 + x] < centerMin) centerMin = topThird[y * 100 + x];
          }
        }

        if (leftMax > 220 && rightMax > 220 && centerMin < 15) {
          console.log(`EXACT MATCH SCREENSHOT 1: ${img.fileName} (${img.storagePath}) leftMax=${leftMax} rightMax=${rightMax} centerMin=${centerMin}`);
        }
      }

      // Screenshot 2: wide/landscape, nadir down middle, structure in upper-left quadrant
      if (w > h) {
        const leftHalf = await sharp(fullPath)
          .extract({ left: 0, top: 0, width: Math.round(w * 0.45), height: Math.round(h * 0.5) })
          .resize(100, 100)
          .grayscale()
          .raw()
          .toBuffer();
        let maxVal = 0, minVal = 255;
        for (let i = 0; i < leftHalf.length; i++) {
          if (leftHalf[i] > maxVal) maxVal = leftHalf[i];
          if (leftHalf[i] < minVal) minVal = leftHalf[i];
        }
        if (maxVal > 240 && minVal < 5) {
          console.log(`POTENTIAL SCREENSHOT 2 (landscape): ${img.fileName} (${img.storagePath}) max=${maxVal} min=${minVal}`);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  await mongoose.disconnect();
}

findExactImages().catch(console.error);
