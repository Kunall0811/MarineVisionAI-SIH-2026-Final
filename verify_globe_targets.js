async function testGlobe() {
  const adminLogin = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  }).then(r => r.json());
  const token = adminLogin.data.accessToken;

  // Test Globe Anomalies
  const globeRes = await fetch('http://localhost:4000/api/globe/anomalies', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());

  console.log(`Total Globe Anomalies: ${globeRes.data?.length || 0}`);
  const userTargets = (globeRes.data || []).filter(a => a.anomalyCode && /^ANOM-\d+$/.test(a.anomalyCode));
  console.log(`Found User Targets (ANOM-01 to ANOM-20): ${userTargets.length}`);
  
  userTargets.slice(0, 5).forEach(t => {
    console.log(`  ${t.anomalyCode} | ${t.targetName} | ${t.detailedType} | Coords: (${t.latitude}, ${t.longitude}) | Depth: ${t.depthFt} (${t.depth}m) | Risk: ${t.riskLevel}`);
  });

  // Test Operator Access to Anomalies
  const opLogin = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@marinevision.ai', password: 'Operator@12345' }),
  }).then(r => r.json());
  const opToken = opLogin.data.accessToken;

  const opGlobeRes = await fetch('http://localhost:4000/api/globe/anomalies', {
    headers: { Authorization: `Bearer ${opToken}` },
  }).then(r => r.json());
  const opUserTargets = (opGlobeRes.data || []).filter(a => a.anomalyCode && /^ANOM-\d+$/.test(a.anomalyCode));
  console.log(`Operator Globe Access Confirmed: ${opUserTargets.length} user targets accessible to Operator.`);

  // Test Historical References
  const histRes = await fetch('http://localhost:4000/api/globe/historical-reference', {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
  const histTargets = (histRes.data || []).filter(h => h.sourceId && h.sourceId.startsWith('NOAA-ANOM-'));
  console.log(`Found Historical Reference Records for Targets: ${histTargets.length}`);
}

testGlobe().catch(console.error);
