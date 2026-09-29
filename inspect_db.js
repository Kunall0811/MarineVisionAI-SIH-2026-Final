const mongoose = require('./backend/node_modules/mongoose');

async function inspectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/marinevision';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', uri);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const datasets = await mongoose.connection.db.collection('ai_datasets').find().toArray();
  console.log('\n--- AI DATASETS --- (' + datasets.length + ')');
  for (const d of datasets) {
    console.log(`ID: ${d._id}, Name: "${d.name}", Classes: [${d.classes?.join(', ')}]`);
  }

  const dsImagesCount = await mongoose.connection.db.collection('ai_dataset_images').countDocuments();
  console.log('\n--- AI DATASET IMAGES COUNT ---:', dsImagesCount);

  const sampleImages = await mongoose.connection.db.collection('ai_dataset_images').find().limit(15).toArray();
  console.log('Sample ai dataset images:');
  for (const img of sampleImages) {
    console.log(`  File: ${img.fileName}, Label: ${img.label}, Split: ${img.split}, Storage: ${img.storagePath}, Annotations: ${img.annotations?.length}`);
  }

  const labelCounts = await mongoose.connection.db.collection('ai_dataset_images').aggregate([
    { $group: { _id: '$label', count: { $sum: 1 } } }
  ]).toArray();
  console.log('\nDataset Images by Label:', labelCounts);

  const surveys = await mongoose.connection.db.collection('surveys').find().toArray();
  console.log('\n--- SURVEYS --- (' + surveys.length + ')');
  for (const s of surveys) {
    console.log(`ID: ${s._id}, Code: ${s.code}, Name: "${s.name}", Status: ${s.status}`);
  }

  const framesCount = await mongoose.connection.db.collection('sonar_frames').countDocuments();
  console.log('\n--- SONAR FRAMES COUNT ---:', framesCount);

  const detectionsCount = await mongoose.connection.db.collection('detections').countDocuments();
  console.log('\n--- DETECTIONS COUNT ---:', detectionsCount);

  const detByClass = await mongoose.connection.db.collection('detections').aggregate([
    { $group: { _id: '$class', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Detections by Class:', detByClass);

  await mongoose.disconnect();
}

inspectDb().catch(console.error);
