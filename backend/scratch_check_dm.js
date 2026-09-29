const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function checkRaw() {
  const dir = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw';
  const files = fs.readdirSync(dir).filter(f => f.startsWith('DM_Wilson_') && f.endsWith('.png'));
  console.log(`Checking ${files.length} DM_Wilson files in raw:`);

  for (const f of files) {
    const fullPath = path.join(dir, f);
    const meta = await sharp(fullPath).metadata();
    console.log(`  ${f}: ${meta.width}x${meta.height}`);
  }
}

checkRaw().catch(console.error);
