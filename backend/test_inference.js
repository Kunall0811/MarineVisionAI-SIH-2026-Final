const fs = require('fs');
const path = require('path');

async function test() {
  // 1. Login
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@marinevision.ai', password: 'Admin@12345' }),
  });
  const loginData = await loginRes.json();
  console.log('Login response:', loginData);
  const token = loginData.token || loginData.accessToken || loginData.data?.accessToken || loginData.data?.token;
  console.log('Login success, token obtained:', !!token);

  // 2. Test rock image
  const imgPath = path.resolve('../datasets/test/images/rock_0037.png');
  console.log('Testing image:', imgPath);
  
  const buf = fs.readFileSync(imgPath);
  const blob = new Blob([buf], { type: 'image/png' });
  const form = new FormData();
  form.append('image', blob, 'rock_0037.png');

  const res = await fetch('http://localhost:4000/api/ai/analyze-sonar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  console.log('Response Status:', res.status);
  const json = await res.json();
  console.log('--- LIVE INFERENCE RESULT ---');
  console.log(JSON.stringify({
    status: json.status,
    classification: json.classification,
    confidence: json.confidence,
    detectionsCount: json.detections?.length,
    detections: json.detections,
    model: json.model,
    shapeAnalysis: json.shapeAnalysis,
    materialAnalysis: json.materialAnalysis,
  }, null, 2));
}

test().catch(console.error);
