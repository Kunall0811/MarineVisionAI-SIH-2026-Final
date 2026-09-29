const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Find all PNG files in the repository
function findPngs(dir, list = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) findPngs(full, list);
      else if (e.name.endsWith('.png') && !e.name.startsWith('crop_') && !e.name.startsWith('test_')) {
        list.push(full);
      }
    }
  } catch {}
  return list;
}

async function searchShip() {
  const pngs = findPngs('D:/MarineVision-AI-SIH26057-Upgraded');
  console.log(`Searching through ${pngs.length} PNGs...`);

  // Target feature: In Screenshot 2, the ship has very bright pixels (val > 220)
  // surrounded by very dark acoustic shadow (val < 15) in the top half of the image (y < 0.4 * H).
  for (const p of pngs) {
    try {
      const meta = await sharp(p).metadata();
      if (meta.width < 500 || meta.height < 500) continue;

      // Extract top half, right side: x: 0.5*W .. W, y: 0 .. 0.4*H
      const cropW = Math.round(meta.width * 0.45);
      const cropH = Math.round(meta.height * 0.35);
      const cropX = Math.round(meta.width * 0.50);
      const cropY = Math.round(meta.height * 0.02);

      const stats = await sharp(p)
        .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
        .stats();

      const minVal = stats.channels[0].min;
      const maxVal = stats.channels[0].max;

      // In Screenshot 2, the ship's shadow is pitch black (min < 5), and the hull has max > 220
      if (minVal <= 5 && maxVal >= 230) {
        // Check if there is also an elongated diagonal feature
        console.log(`POTENTIAL SHIP FILE: ${p} (${meta.width}x${meta.height}) min=${minVal} max=${maxVal} mean=${stats.channels[0].mean.toFixed(1)}`);
      }
    } catch {}
  }
}

searchShip().catch(console.error);
