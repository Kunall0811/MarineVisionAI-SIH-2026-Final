const mongoose = require('mongoose');

async function inspectUserDatasets() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetIds = ['6ab81c2c85cb433e2314c9fb', '6ab81cb985cb433e2314cd9d', '6ab81d7285cb433e2314d1f1'];
  for (const id of datasetIds) {
    const ds = await db.collection('ai_datasets').findOne({ _id: new mongoose.Types.ObjectId(id) });
    console.log(`\nDataset ID: ${id}`);
    console.log('Dataset Name:', ds ? ds.name : 'null');
    console.log('Classes:', ds ? ds.classes : 'null');
    console.log('Created:', ds ? ds.createdAt : 'null');

    const images = await db.collection('ai_dataset_images').find({ datasetId: new mongoose.Types.ObjectId(id) }).toArray();
    console.log(`Images count: ${images.length}`);
    const labelCounts = {};
    for (const img of images) {
      labelCounts[img.label] = (labelCounts[img.label] || 0) + 1;
    }
    console.log('Label distribution:', labelCounts);

    if (images.length > 0) {
      console.log('Sample image paths:');
      images.slice(0, 5).forEach(img => {
        console.log(`  - label: ${img.label} | storagePath: ${img.storagePath} | width: ${img.width} | height: ${img.height}`);
      });
    }
  }

  // Also check recent detections in the database!
  const recentDetections = await db.collection('detections').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('\nRecent Detections in DB:', recentDetections.length);
  for (const det of recentDetections) {
    console.log(`  - Detection: label=${det.classification} conf=${det.confidence} box=${JSON.stringify(det.bbox || det.boundingBox)} image=${det.imagePath || det.imageUrl}`);
  }

  await mongoose.disconnect();
}

inspectUserDatasets().catch(console.error);
