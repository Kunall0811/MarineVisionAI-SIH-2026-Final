const fs = require('fs');
const path = require('path');

async function test120() {
  console.log('Testing 120-image batch analysis...');
  
  // 1. Login
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) throw new Error('Auth failed');

  // 2. Collect 120 images from dataset
  const allImages = [];
  function listAll(dir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) listAll(full);
        else if (f.endsWith('.png') || f.endsWith('.jpg')) allImages.push(full);
      } catch {}
    }
  }
  listAll('../datasets');
  console.log(`Found ${allImages.length} available sonar images in datasets.`);

  // Pick 120 images (cycle if necessary)
  const test120Files = [];
  for (let i = 0; i < 120; i++) {
    test120Files.push(allImages[i % allImages.length]);
  }
  console.log(`Selected ${test120Files.length} images for 120-batch test.`);

  // 3. Process in chunks of 50 as done by frontend services.ts
  const CHUNK_SIZE = 50;
  const allResults = [];
  let totalDetections = 0;

  for (let i = 0; i < test120Files.length; i += CHUNK_SIZE) {
    const chunk = test120Files.slice(i, i + CHUNK_SIZE);
    const form = new FormData();
    for (let j = 0; j < chunk.length; j++) {
      const imgPath = chunk[j];
      const buf = fs.readFileSync(imgPath);
      const filename = `sonar_frame_${String(i + j + 1).padStart(3, '0')}.png`;
      form.append('images', new Blob([buf], { type: 'image/png' }), filename);
    }
    form.append('plotOnGlobe', 'false');
    form.append('createDataset', 'false');

    console.log(`Sending chunk of ${chunk.length} images (offset ${i})...`);
    const res = await fetch('http://localhost:4000/api/ai/analyze-batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    
    const data = await res.json();
    console.log(`Chunk ${i / CHUNK_SIZE + 1} status: ${res.status}, processed: ${data.totalProcessed || data.results?.length}`);
    if (data.results) {
      allResults.push(...data.results);
      totalDetections += data.detectionsCount || 0;
    }
  }

  console.log('\n=============================================');
  console.log('120-IMAGE TEST RESULTS:');
  console.log('=============================================');
  console.log(`Selected Images:   ${test120Files.length}`);
  console.log(`Processed Results: ${allResults.length}`);
  console.log(`Total Detections:  ${totalDetections}`);
  console.log(`All 120 accessible: ${allResults.length === 120 ? 'YES (PASSED)' : 'NO'}`);
  console.log('First result:', allResults[0]?.filename, allResults[0]?.classification);
  console.log('Middle result (50):', allResults[49]?.filename, allResults[49]?.classification);
  console.log('Last result (120):', allResults[119]?.filename, allResults[119]?.classification);
  console.log('=============================================');
}

test120().catch(console.error);
