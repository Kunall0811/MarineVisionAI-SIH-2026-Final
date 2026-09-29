const mongoose = require('mongoose');

async function listAll141() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const dsId = new mongoose.Types.ObjectId('6ab81c2c85cb433e2314c9fb');
  const images = await mongoose.connection.db.collection('ai_dataset_images').find({ datasetId: dsId }).toArray();
  console.log(`Total images in 141 dataset: ${images.length}`);
  const prefixes = {};
  for (const img of images) {
    const prefix = img.fileName.replace(/_\d+\.png$/i, '');
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }
  console.log('Unique object sets in 141 dataset:');
  console.log(prefixes);
  await mongoose.disconnect();
}

listAll141().catch(console.error);
