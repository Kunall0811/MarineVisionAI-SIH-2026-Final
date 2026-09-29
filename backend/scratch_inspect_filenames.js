const mongoose = require('mongoose');

async function inspectFilenames() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(datasetId) }).toArray();

  console.log(`Dataset ${datasetId} has ${images.length} images.`);
  const nameCounts = {};
  for (const img of images) {
    nameCounts[img.fileName] = (nameCounts[img.fileName] || 0) + 1;
  }
  console.log('Unique file names and counts:');
  console.log(nameCounts);

  await mongoose.disconnect();
}

inspectFilenames().catch(console.error);
