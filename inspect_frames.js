const mongoose = require('./backend/node_modules/mongoose');

async function inspectFrames() {
  await mongoose.connect('mongodb://localhost:27017/marinevision');
  const frames = await mongoose.connection.db.collection('sonar_frames').find().toArray();
  console.log(`Total SonarFrames: ${frames.length}`);
  for (const f of frames) {
    console.log(`ID: ${f._id} | File: ${f.fileName} | Storage: ${f.storagePath} | Status: ${f.processingStatus}`);
  }

  // Also check detections linked to these frames
  const detections = await mongoose.connection.db.collection('detections').find({
    sonarFrameId: { $in: frames.map(f => f._id) }
  }).toArray();
  console.log(`\nDetections linked to SonarFrames: ${detections.length}`);
  for (const d of detections) {
    console.log(`Det ID: ${d._id} | Code: ${d.anomalyCode} | Frame: ${d.sonarFrameId} | Class: ${d.class} | Conf: ${d.confidence} | BBox: ${JSON.stringify(d.bbox)}`);
  }

  await mongoose.disconnect();
}
inspectFrames();
