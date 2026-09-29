const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Find the image that has two distinct high-intensity arcs/pipes near the top
async function findScreenshot1() {
  const dirs = [
    'ml/dataset/raw',
    'backend/sonar-storage/surveys/training/6ab8e57793676dbff84e6a3d',
    'backend/sonar-storage/surveys/training/6ab81c2c85cb433e2314c9fb',
    'backend/sonar-storage/surveys/SURV-HIST-NOAA'
  ];

  for (const d of dirs) {
    const fullDir = path.join(__dirname, '..', d);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.png'));
    console.log(`Checking ${files.length} files in ${d}...`);
    for (const f of files) {
      const p = path.join(fullDir, f);
      try {
        const meta = await sharp(p).metadata();
        // Screenshot 1 is taller than wide (aspect ratio around 0.7)
        if (meta.height > meta.width) {
          // Check top 30% for bright horizontal arcs
          const topBuf = await sharp(p)
            .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.3) })
            .resize(64, 64)
            .grayscale()
            .raw()
            .toBuffer();
          
          let maxVal = 0;
          for (let i = 0; i < topBuf.length; i++) {
            if (topBuf[i] > maxVal) maxVal = topBuf[i];
          }
          if (maxVal > 240) {
            console.log(`Candidate: ${f} in ${d} (${meta.width}x${meta.height}) max=${maxVal}`);
          }
        }
      } catch {}
    }
  }
}

findScreenshot1().catch(console.error);
