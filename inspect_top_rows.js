const sharp = require('./backend/node_modules/sharp');
const path = require('path');

async function inspectTopRows() {
  const p = path.join(__dirname, 'ml', 'dataset', 'raw', 'DM_Wilson_08.png');
  const rows = 32;
  const cols = 32;
  const { data } = await sharp(p).grayscale().resize(cols, rows, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });

  console.log('Row 0 (y=0..87) across all cols:');
  const r0 = [];
  for (let c = 0; c < cols; c++) r0.push(`c${c}:${data[0 * cols + c]}`);
  console.log(r0.slice(0, 16).join(' '));
  console.log(r0.slice(16).join(' '));

  console.log('\nRow 1 (y=87..173) across all cols:');
  const r1 = [];
  for (let c = 0; c < cols; c++) r1.push(`c${c}:${data[1 * cols + c]}`);
  console.log(r1.slice(0, 16).join(' '));
  console.log(r1.slice(16).join(' '));

  console.log('\nRow 2 (y=173..260) across all cols:');
  const r2 = [];
  for (let c = 0; c < cols; c++) r2.push(`c${c}:${data[2 * cols + c]}`);
  console.log(r2.slice(0, 16).join(' '));
  console.log(r2.slice(16).join(' '));
}
inspectTopRows();
