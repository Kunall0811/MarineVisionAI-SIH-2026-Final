const fs = require('fs');
const path = require('path');

async function test120Batch() {
  console.log('Testing 120-image batch upload & analysis...');

  // 1. Login as Admin
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken || loginData.accessToken;
  console.log('Logged in successfully, token exists:', Boolean(token));

  // 2. Collect 120 real images from datasets & storage
  const images = [];
  const dirs = [
    path.join(__dirname, 'datasets', 'train', 'images'),
    path.join(__dirname, 'datasets', 'val', 'images'),
    path.join(__dirname, 'datasets', 'test', 'images'),
    path.join(__dirname, 'ml', 'dataset', 'raw'),
  ];

  for (const d of dirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d).filter(f => f.endsWith('.png'));
      for (const f of files) {
        if (images.length < 120) {
          images.push(path.join(d, f));
        }
      }
    }
    if (images.length >= 120) break;
  }

  console.log(`Collected ${images.length} images for 120-batch test.`);

  // 3. Send in 3 chunks: Chunk 1: 50, Chunk 2: 50, Chunk 3: 20
  const chunkSizes = [50, 50, 20];
  let offset = 0;
  let totalProcessed = 0;
  let totalDetections = 0;
  const allResults = [];

  for (let c = 0; c < chunkSizes.length; c++) {
    const size = chunkSizes[c];
    const chunkFiles = images.slice(offset, offset + size);
    console.log(`Sending Chunk ${c + 1} (${chunkFiles.length} images, offset ${offset})...`);

    const form = new FormData();
    for (const fileP of chunkFiles) {
      const buf = fs.readFileSync(fileP);
      const b = new Blob([buf], { type: 'image/png' });
      form.append('images', b, path.basename(fileP));
    }
    form.append('latitude', '18.9220');
    form.append('longitude', '72.8346');
    form.append('stepLat', '0.0003');
    form.append('stepLon', '0.0004');
    form.append('waterBodyName', 'Arabian Sea Shelf');

    const res = await fetch('http://localhost:4000/api/ai/analyze-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    console.log(`Chunk ${c + 1} HTTP status: ${res.status}`);
    if (res.status === 201) {
      const data = await res.json();
      console.log(`Chunk ${c + 1} processed: ${data.totalProcessed}, detections: ${data.detectionsCount}`);
      totalProcessed += data.totalProcessed;
      totalDetections += data.detectionsCount;
      allResults.push(...data.results);
    } else {
      const errText = await res.text();
      console.error(`Chunk ${c + 1} ERROR:`, errText.slice(0, 300));
    }

    offset += size;
  }

  console.log('\n=============================================');
  console.log('120-IMAGE TEST RESULTS:');
  console.log('=============================================');
  console.log(`Selected Images:   ${images.length}`);
  console.log(`Processed Results: ${totalProcessed}`);
  console.log(`Total Detections:  ${totalDetections}`);
  console.log(`All 120 accessible: ${totalProcessed === 120 ? 'YES - 100% COMPLETE' : 'NO'}`);
  console.log(`First result: ${allResults[0]?.filename} -> ${allResults[0]?.classification} (${allResults[0]?.imageUrl})`);
  console.log(`50th result:  ${allResults[49]?.filename} -> ${allResults[49]?.classification} (${allResults[49]?.imageUrl})`);
  console.log(`100th result: ${allResults[99]?.filename} -> ${allResults[99]?.classification} (${allResults[99]?.imageUrl})`);
  console.log(`120th result: ${allResults[119]?.filename} -> ${allResults[119]?.classification} (${allResults[119]?.imageUrl})`);
  console.log('=============================================\n');
}

test120Batch().catch(console.error);
