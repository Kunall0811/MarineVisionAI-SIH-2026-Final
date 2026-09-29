const mongoose = require('mongoose');

async function checkDoc() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasetId = '6ab81d7285cb433e2314d1f1';
  const img = await db.collection('ai_dataset_images').findOne({ datasetId: new mongoose.Types.ObjectId(datasetId) });
  console.log('Doc keys:', Object.keys(img));
  console.log('Sample doc:', JSON.stringify(img, null, 2));

  // Also check plotted detections from that dataset
  const detections = await db.collection('detections').find({}).sort({ createdAt: -1 }).limit(20).toArray();
  console.log('\nDetections count:', detections.length);
  for (const d of detections) {
    console.log(`  class=${d.class} targetName=${d.targetName} box=${JSON.stringify(d.bbox)}`);
  }

  await mongoose.disconnect();
}

checkDoc().catch(console.error);
