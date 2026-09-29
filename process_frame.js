async function main() {
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  });
  console.log('Login status:', loginRes.status);
  const loginBody = await loginRes.json();
  console.log('Login body:', loginBody);
  const accessToken = loginBody.data?.accessToken || loginBody.accessToken;

  const frameId = '6ab7a27d474cc70de16be0a0';
  console.log(`Processing SonarFrame: ${frameId}`);
  const res = await fetch(`http://localhost:4000/api/sonar/${frameId}/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log('Process response status:', res.status);
  const data = await res.json();
  console.log('Process result:', JSON.stringify(data, null, 2));

  // Check detections created for this frame
  const detRes = await fetch(`http://localhost:4000/api/detections`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const detections = await detRes.json();
  const frameDets = (detections.data || []).filter(d => String(d.sonarFrameId) === frameId);
  console.log(`Detections linked to frame ${frameId}:`, frameDets.length);
  for (const d of frameDets) {
    console.log(`  Det ${d.anomalyCode}: class=${d.class}, conf=${d.finalConfidence}, bbox=${JSON.stringify(d.bbox)}`);
  }
}

main().catch(console.error);
