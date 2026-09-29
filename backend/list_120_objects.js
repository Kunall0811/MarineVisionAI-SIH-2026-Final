const mongoose = require('mongoose');

async function listAll120() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const dsId = new mongoose.Types.ObjectId('6ab8e57793676dbff84e6a3d');
  const images = await mongoose.connection.db.collection('ai_dataset_images').find({ datasetId: dsId }).toArray();
  console.log(`Total images in 120 dataset: ${images.length}`);
  const prefixes = {};
  for (const img of images) {
    const prefix = img.fileName.replace(/_\d+\.png$/i, '');
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }
  console.log('Unique object sets in 120 dataset:');
  console.log(prefixes);
  await mongoose.disconnect();
}

listAll120().catch(console.error);
