const mongoose = require('mongoose');

async function inspect120() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const dsId = new mongoose.Types.ObjectId('6ab8e57793676dbff84e6a3d');
  const images = await mongoose.connection.db.collection('ai_dataset_images').find({ datasetId: dsId }).toArray();
  console.log('Images in 120-image dataset:', images.length);
  const labels = {};
  images.forEach(img => {
    labels[img.label] = (labels[img.label] || 0) + 1;
  });
  console.log('Labels assigned by batch analysis:', labels);
  console.log('First 20 images:', images.slice(0, 20).map(x => ({ fileName: x.fileName, label: x.label, storagePath: x.storagePath })));
  await mongoose.disconnect();
}

inspect120().catch(console.error);
