const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function testVariousFiles() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(datasetId) }).toArray();

  const fileMap = {};
  for (const img of images) {
    fileMap[img.fileName] = path.join('D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage', img.storagePath);
  }

  const sampleNames = [
    'DM_Wilson_01.png',
    'DM_Wilson_08.png',
    'Near_Shore_01.png',
    'Near_Shore_03.png',
    'Heart_Failure_01.png',
    'Heart_Failure_05.png',
    'EB_Allen_01.png',
    'Egyptian_01.png',
  ];

  for (const name of sampleNames) {
    const fPath = fileMap[name];
    if (fPath && fs.existsSync(fPath)) {
      const meta = await sharp(fPath).metadata();
      console.log(`Found ${name}: ${meta.width}x${meta.height}`);
    } else {
      console.log(`Not found: ${name}`);
    }
  }

  await mongoose.disconnect();
}

testVariousFiles().catch(console.error);
