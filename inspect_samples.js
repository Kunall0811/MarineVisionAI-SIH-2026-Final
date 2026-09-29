const mongoose = require('./backend/node_modules/mongoose');
const fs = require('fs');
const path = require('path');

async function inspectImages() {
  await mongoose.connect('mongodb://localhost:27017/marinevision');
  const classes = ['ghost_net', 'fishing_gear', 'container', 'pipe', 'cylinder', 'marine_debris', 'rock', 'artificial_structure', 'shipwreck'];
  for (const c of classes) {
    const doc = await mongoose.connection.db.collection('ai_dataset_images').findOne({ label: c });
    if (doc) {
      const fullPath = path.join(__dirname, 'backend', 'sonar-storage', doc.storagePath);
      const exists = fs.existsSync(fullPath);
      console.log(`Class: ${c.padEnd(20)} File: ${doc.fileName.padEnd(30)} Exists: ${exists} Annotations: ${JSON.stringify(doc.annotations || [])}`);
    } else {
      console.log(`Class: ${c.padEnd(20)} No document found!`);
    }
  }
  await mongoose.disconnect();
}
inspectImages();
