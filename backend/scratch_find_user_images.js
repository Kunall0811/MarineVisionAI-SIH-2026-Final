const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

async function findImages() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(datasetId) }).toArray();
  console.log(`Found ${images.length} images in dataset ${datasetId}`);

  // Check storage directory
  const baseStorage = path.join('D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage');
  console.log('Storage base exists:', fs.existsSync(baseStorage));

  for (let i = 0; i < Math.min(10, images.length); i++) {
    const fullPath = path.join(baseStorage, images[i].storagePath);
    console.log(`Image [${i}]: exists=${fs.existsSync(fullPath)} path=${fullPath}`);
  }

  await mongoose.disconnect();
}

findImages().catch(console.error);
