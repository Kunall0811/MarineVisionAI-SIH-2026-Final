const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function analyzeAllImages() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/backend/sonar-storage/surveys/training/6ab81d7285cb433e2314d1f1';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  console.log(`Analyzing ${files.length} images...`);

  // Let's check statistics on 15 different files across the dataset
  const step = Math.floor(files.length / 15);
  for (let i = 0; i < files.length; i += step) {
    const f = files[i];
    const fullPath = path.join(dir, f);
    const meta = await sharp(fullPath).metadata();
    
    // Resize to 64x64 to get global mean, min, max, std
    const { data } = await sharp(fullPath)
      .resize(64, 64, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    let min = 255;
    let max = 0;
    for (let j = 0; j < data.length; j++) {
      const v = data[j];
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const mean = sum / data.length;
    let varSum = 0;
    for (let j = 0; j < data.length; j++) {
      varSum += (data[j] - mean) ** 2;
    }
    const std = Math.sqrt(varSum / data.length);

    console.log(`[${i}] ${f} (${meta.width}x${meta.height}) - mean: ${mean.toFixed(1)}, std: ${std.toFixed(1)}, min: ${min}, max: ${max}`);
  }
}

analyzeAllImages().catch(console.error);
