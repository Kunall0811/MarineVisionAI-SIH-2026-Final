const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

async function findScreenshot2() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const dsId = new mongoose.Types.ObjectId('6ab8e57793676dbff84e6a3d');
  const images = await mongoose.connection.db.collection('ai_dataset_images').find({ datasetId: dsId }).toArray();

  for (const img of images) {
    const fullPath = path.join(__dirname, 'sonar-storage', img.storagePath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const meta = await sharp(fullPath).metadata();
      // Look for landscape or square where nadir is horizontal/vertical, with rib structure
      // Screenshot 2: image is roughly 2:1 or wider (w > h)
      if (meta.width > meta.height) {
        // Upper left has a distinct structure around x: 20%..45%, y: 15%..45%
        const W = meta.width;
        const H = meta.height;
        const crop = await sharp(fullPath)
          .extract({ left: Math.round(W * 0.2), top: Math.round(H * 0.15), width: Math.round(W * 0.25), height: Math.round(H * 0.3) })
          .resize(50, 50)
          .grayscale()
          .raw()
          .toBuffer();
        
        let minV = 255, maxV = 0, mean = 0;
        for (let i = 0; i < crop.length; i++) {
          if (crop[i] < minV) minV = crop[i];
          if (crop[i] > maxV) maxV = crop[i];
          mean += crop[i];
        }
        mean /= crop.length;

        // In Screenshot 2, the rib structure has very bright bars (max > 220) and dark shadow (min < 10)
        if (maxV > 230 && minV < 8) {
          console.log(`SCREENSHOT 2 CANDIDATE: ${img.fileName} (${img.storagePath}) ${W}x${H} max=${maxV} min=${minV} mean=${mean.toFixed(1)}`);
        }
      }
    } catch {}
  }
  await mongoose.disconnect();
}

findScreenshot2().catch(console.error);
