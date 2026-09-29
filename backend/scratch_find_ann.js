const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

async function findExactImage() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(datasetId) }).toArray();
  const baseStorage = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage';

  // In Screenshot 2:
  // Look at the bounding box in Screenshot 2:
  // x1 appears to be around 35-40% of width (just right of center), width is ~15-20% of image width.
  // And y spans from around y=350 all the way to near the bottom!
  // In the DB, let's look at the annotations saved for these images:
  for (let i = 0; i < images.length; i++) {
    const ann = images[i].annotations && images[i].annotations[0];
    if (ann) {
      // Print first 10 annotations
      if (i < 10) {
        console.log(`[${i}] ${images[i].storagePath}: ann = ${JSON.stringify(ann)}`);
      }
      // Check if ann matches Screenshot 2 (x around 600..700, y around 200..400, height > 2000)
      if (ann.y < 500 && ann.height > 2000) {
        console.log(`MATCH CANDIDATE [${i}] ${images[i].storagePath}: ann = ${JSON.stringify(ann)}`);
      }
    }
  }

  await mongoose.disconnect();
}

findExactImage().catch(console.error);
