const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function findShipInDmFiles() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw';
  const files = fs.readdirSync(dir).filter(f => f.startsWith('DM_Wilson_') && f.endsWith('.png'));

  for (const f of files) {
    const fullPath = path.join(dir, f);
    const meta = await sharp(fullPath).metadata();
    
    // In Screenshot 2, the ship is near the top right:
    // x around 0.55 to 0.85 of width, y around 0.02 to 0.20 of height.
    // Let's crop that region and compute brightness & contrast
    const cropX = Math.round(meta.width * 0.45);
    const cropY = Math.round(meta.height * 0.01);
    const cropW = Math.round(meta.width * 0.45);
    const cropH = Math.round(meta.height * 0.25);

    const stats = await sharp(fullPath)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .stats();

    console.log(`${f} (${meta.width}x${meta.height}): top-right crop mean=${stats.channels[0].mean.toFixed(1)}, max=${stats.channels[0].max}, std=${stats.channels[0].stdev.toFixed(1)}`);
  }
}

findShipInDmFiles().catch(console.error);
