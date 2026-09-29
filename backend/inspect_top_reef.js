const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function inspectTopReef() {
  const imgPath = path.join(__dirname, 'sonar-storage/surveys/training/6ab8e57793676dbff84e6a3d/2c10626fa1270eb2.png');
  const meta = await sharp(imgPath).metadata();
  const W = meta.width; // 1728
  const H = meta.height; // 2501

  // Extract top 35%
  const topH = Math.round(H * 0.35); // ~875px
  const buf = await sharp(imgPath)
    .extract({ left: 0, top: 0, width: W, height: topH })
    .grayscale()
    .raw()
    .toBuffer();

  // Find pixels > 220
  let leftObj = { minX: W, maxX: 0, minY: H, maxY: 0, count: 0 };
  let rightObj = { minX: W, maxX: 0, minY: H, maxY: 0, count: 0 };
  const midX = W / 2;

  for (let y = 0; y < topH; y++) {
    for (let x = 0; x < W; x++) {
      const v = buf[y * W + x];
      if (v > 220) {
        if (x < midX - 50) {
          leftObj.minX = Math.min(leftObj.minX, x);
          leftObj.maxX = Math.max(leftObj.maxX, x);
          leftObj.minY = Math.min(leftObj.minY, y);
          leftObj.maxY = Math.max(leftObj.maxY, y);
          leftObj.count++;
        } else if (x > midX + 50) {
          rightObj.minX = Math.min(rightObj.minX, x);
          rightObj.maxX = Math.max(rightObj.maxX, x);
          rightObj.minY = Math.min(rightObj.minY, y);
          rightObj.maxY = Math.max(rightObj.maxY, y);
          rightObj.count++;
        }
      }
    }
  }

  console.log(`Left Object (Port Arc):`, leftObj);
  console.log(`Right Object (Starboard Arc):`, rightObj);
  console.log(`Relative to 1728x2501:`);
  console.log(`Left bbox in [0..1]: [${(leftObj.minX/W).toFixed(3)}, ${(leftObj.minY/H).toFixed(3)}, ${(leftObj.maxX/W).toFixed(3)}, ${(leftObj.maxY/H).toFixed(3)}]`);
  console.log(`Right bbox in [0..1]: [${(rightObj.minX/W).toFixed(3)}, ${(rightObj.minY/H).toFixed(3)}, ${(rightObj.maxX/W).toFixed(3)}, ${(rightObj.maxY/H).toFixed(3)}]`);
}

inspectTopReef().catch(console.error);
