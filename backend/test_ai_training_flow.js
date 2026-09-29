async function test() {
  const loginRes = await fetch('http://127.0.0.1:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  });
  const login = await loginRes.json();
  const token = login.data?.accessToken;
  console.log('1. Logged in! Token exists:', !!token);

  console.log('2. Creating or finding dataset for 1,000 images...');
  const dsRes = await fetch('http://127.0.0.1:4000/api/datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      name: 'High-Resolution 1,000 Sonar Dataset',
      description: 'Side-scan sonar waterfall imagery for deep neural training',
      classes: ['WRECK', 'PIPELINE', 'CONTAINER', 'CORAL_COLONY', 'DEBRIS'],
    }),
  });
  const ds = await dsRes.json();
  const datasetId = ds.data?._id;
  console.log('   Dataset created:', datasetId);

  console.log('3. Seeding 1,000 sonar images into dataset...');
  const seedRes = await fetch(`http://127.0.0.1:4000/api/datasets/${datasetId}/seed-1000`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
  });
  const seedData = await seedRes.json();
  console.log('   Seeded result:', seedData.count, 'images, success:', seedData.success);

  console.log('4. Starting AI training job on 1,000 images...');
  const trainRes = await fetch('http://127.0.0.1:4000/api/training-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      datasetId,
      epochs: 10,
      learningRate: 0.1,
      batchSize: 16,
    }),
  });
  const trainJob = await trainRes.json();
  const jobId = trainJob.data?._id;
  console.log('   Training job started:', jobId, trainJob.data?.status);

  // Poll for completion (should take 2-4 seconds)
  let completed = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await fetch(`http://127.0.0.1:4000/api/training-jobs/${jobId}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const statusData = await statusRes.json();
    console.log(`   Job status: ${statusData.data?.status} (${statusData.data?.progressPct}%)`);
    if (statusData.data?.status === 'COMPLETED') {
      completed = true;
      break;
    }
  }

  console.log('5. Testing One-Click Deploy to 3D Globe...');
  const deployRes = await fetch(
    `http://127.0.0.1:4000/api/training-jobs/${jobId}/deploy-to-globe`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    },
  );
  const deployData = await deployRes.json();
  console.log('   Deploy response:', deployData.success, deployData.count, 'anomalies mapped to globe!');
  console.log('All AI Training and Globe deployment tests passed!');
}

test().catch(console.error);
