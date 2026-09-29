const sharp = require('sharp');

async function testEdgeEnergy() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  
  // Crop the ship region: x: 1000..1500, y: 0..800
  const shipCrop = await sharp(file)
    .extract({ left: 1000, top: 0, width: 500, height: 800 })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Crop the sand bank region: x: 1000..1500, y: 4000..4800
  const sandCrop = await sharp(file)
    .extract({ left: 1000, top: 4000, width: 500, height: 800 })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute Sobel gradient magnitude for both crops
  function computeSobel(buffer, w, h) {
    let edgeSum = 0;
    let highEdgeCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -buffer[(y - 1) * w + (x - 1)] + buffer[(y - 1) * w + (x + 1)] +
          -2 * buffer[y * w + (x - 1)] + 2 * buffer[y * w + (x + 1)] +
          -buffer[(y + 1) * w + (x - 1)] + buffer[(y + 1) * w + (x + 1)];
        const gy =
          -buffer[(y - 1) * w + (x - 1)] - 2 * buffer[(y - 1) * w + x] - buffer[(y - 1) * w + (x + 1)] +
          buffer[(y + 1) * w + (x - 1)] + 2 * buffer[(y + 1) * w + x] + buffer[(y + 1) * w + (x + 1)];
        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeSum += mag;
        if (mag > 120) highEdgeCount++;
      }
    }
    const count = (w - 2) * (h - 2);
    return { meanEdge: edgeSum / count, highEdgeCount };
  }

  const shipEdges = computeSobel(shipCrop.data, 500, 800);
  const sandEdges = computeSobel(sandCrop.data, 500, 800);

  console.log('Ship crop edge statistics:');
  console.log(`  Mean edge: ${shipEdges.meanEdge.toFixed(2)}, High-edge pixels (>120): ${shipEdges.highEdgeCount}`);

  console.log('\nSand bank crop edge statistics:');
  console.log(`  Mean edge: ${sandEdges.meanEdge.toFixed(2)}, High-edge pixels (>120): ${sandEdges.highEdgeCount}`);
}

testEdgeEnergy().catch(console.error);
