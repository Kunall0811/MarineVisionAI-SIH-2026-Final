const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

async function inspect() {
  const base = path.join(__dirname, 'sonar-storage/surveys/training');
  const dirs = fs.readdirSync(base);
  console.log('Total dirs in training:', dirs.length);
  let totalFiles = 0;
  const fileNames = new Set();
  const dirCounts = {};

  for (const d of dirs) {
    const p = path.join(base, d);
    if (fs.statSync(p).isDirectory()) {
      const f = fs.readdirSync(p);
      totalFiles += f.length;
      dirCounts[d] = f.length;
      f.forEach(x => fileNames.add(x));
    }
  }

  console.log('Total files across dirs:', totalFiles);
  console.log('Unique file names count:', fileNames.size);
  console.log('Sample file names (first 40):');
  console.log(Array.from(fileNames).slice(0, 40));

  // Connect to MongoDB
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/marinevision');
    const datasets = await mongoose.connection.db.collection('ai_datasets').find({}).toArray();
    console.log('\n--- AI Datasets in DB (' + datasets.length + ') ---');
    for (const ds of datasets) {
      const imgCount = await mongoose.connection.db.collection('ai_dataset_images').countDocuments({ datasetId: ds._id });
      console.log(`Dataset: ${ds._id} | name: "${ds.name}" | images in DB: ${imgCount}`);
    }

    // Inspect label distribution in ai_dataset_images
    const labelCounts = await mongoose.connection.db.collection('ai_dataset_images').aggregate([
      { $group: { _id: '$label', count: { $sum: 1 } } }
    ]).toArray();
    console.log('\n--- Label distribution in ai_dataset_images ---');
    console.log(labelCounts);

  } catch (err) {
    console.error('Mongo error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

inspect().catch(console.error);
