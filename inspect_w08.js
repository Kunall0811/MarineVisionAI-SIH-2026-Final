const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function inspectWilson08Regions() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const meta = await sharp(p).metadata();
  console.log(`Original image: ${meta.width}x${meta.height}`);

  // Extract top region (y=0..1000)
  const topStats = await sharp(p)
    .extract({ left: 0, top: 0, width: meta.width, height: 1000 })
    .stats();
  
  // Extract bottom region (y=1500..2774)
  const bottomStats = await sharp(p)
    .extract({ left: 0, top: 1500, width: meta.width, height: meta.height - 1500 })
    .stats();

  console.log('Top (0..1000):', topStats.channels[0]);
  console.log('Bottom (1500..2774):', bottomStats.channels[0]);
}
inspectWilson08Regions();
