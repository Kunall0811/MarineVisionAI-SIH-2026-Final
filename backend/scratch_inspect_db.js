const mongoose = require('mongoose');

async function inspectDb() {
  await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
  const db = mongoose.connection.db;

  const datasets = await db.collection('ai_datasets').find({}).toArray();
  console.log('\nAI Datasets total:', datasets.length);
  for (const ds of datasets) {
    const imgCount = await db.collection('ai_dataset_images').countDocuments({ datasetId: ds._id });
    console.log(`Dataset: ${ds._id} | Name: "${ds.name}" | Classes: [${ds.classes.join(', ')}] | Images in DB: ${imgCount}`);
  }

  const allImages = await db.collection('ai_dataset_images').find({}).toArray();
  console.log('\nTotal images in ai_dataset_images:', allImages.length);

  // Group by datasetId
  const byDs = {};
  for (const img of allImages) {
    const dId = String(img.datasetId);
    byDs[dId] = (byDs[dId] || 0) + 1;
  }
  console.log('Images by datasetId:', byDs);

  // Print sample images to see storage path and labels
  if (allImages.length > 0) {
    console.log('\nSample 3 images:');
    for (let i = 0; i < Math.min(3, allImages.length); i++) {
      console.log(`  [${i}] label=${allImages[i].label} filename=${allImages[i].filename} storagePath=${allImages[i].storagePath}`);
    }
  }

  await mongoose.disconnect();
}

inspectDb().catch(console.error);
