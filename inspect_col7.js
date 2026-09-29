const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function inspectCol7() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const rows = 32;
  const cols = 32;
  const { data } = await sharp(p).grayscale().resize(cols, rows, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });

  const means = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => data[r * cols + c])
  );

  console.log('Values around best cell (r=1, c=7):');
  for (let r = 0; r < 15; r++) {
    console.log(`r=${r} (y~${Math.round(r * 2774 / 32)}): c6=${means[r][6]}, c7=${means[r][7]}, c8=${means[r][8]}, c9=${means[r][9]}`);
  }
}
inspectCol7();
