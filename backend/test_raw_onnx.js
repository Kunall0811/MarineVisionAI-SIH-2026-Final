const path = require('path');
const fs = require('fs');

async function testInference() {
  const imgPath = path.join(__dirname, 'sonar-storage/surveys/training/6ab8e57793676dbff84e6a3d/93f8dc49e1528d7f.png');
  console.log('Testing image:', imgPath);
  console.log('Exists:', fs.existsSync(imgPath));

  const ort = require('onnxruntime-node');
  const sharp = require('sharp');

  const meta = await sharp(imgPath).metadata();
  console.log('Image dimensions:', meta.width, 'x', meta.height, 'channels:', meta.channels);

  // Run onnx model
  const modelPath = path.join(__dirname, 'ai-models/marine-yolo26x.onnx');
  const session = await ort.InferenceSession.create(modelPath);
  console.log('Session inputs:', session.inputNames, 'outputs:', session.outputNames);

  // Preprocess: sharp 640x640 contain
  const rawBuffer = await sharp(imgPath)
    .removeAlpha()
    .resize(640, 640, { fit: 'fill' }) // or contain
    .raw()
    .toBuffer();

  const floatData = new Float32Array(3 * 640 * 640);
  for (let i = 0; i < 640 * 640; i++) {
    const v = rawBuffer[i] / 255;
    floatData[i] = v;
    floatData[640*640 + i] = v;
    floatData[2*640*640 + i] = v;
  }

  const inputTensor = new ort.Tensor('float32', floatData, [1, 3, 640, 640]);
  const out = await session.run({ [session.inputNames[0]]: inputTensor });
  const data = out[session.outputNames[0]].data;
  console.log('Output tensor shape:', out[session.outputNames[0]].dims);

  const CLASSES = [
    'ghost_net', 'fishing_gear', 'container', 'pipe', 'cylinder',
    'shipwreck', 'rock', 'marine_debris', 'artificial_structure', 'unknown_anomaly'
  ];

  // Inspect first 20 cells
  const stride = 15;
  const cells = [];
  for (let i = 0; i < 400; i++) {
    const off = i * stride;
    const cx = data[off];
    const cy = data[off + 1];
    const w = data[off + 2];
    const h = data[off + 3];
    const obj = data[off + 4];
    const classScores = [];
    for (let c = 0; c < 10; c++) {
      classScores.push({ class: CLASSES[c], score: data[off + 5 + c] });
    }
    classScores.sort((a, b) => b.score - a.score);
    cells.push({ i, cx, cy, w, h, obj, best: classScores[0], second: classScores[1] });
  }

  cells.sort((a, b) => b.obj - a.obj);
  console.log('Top 5 cells by objectness:');
  console.log(cells.slice(0, 5));
}

testInference().catch(console.error);
