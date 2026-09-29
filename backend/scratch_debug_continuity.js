const sharp = require('sharp');

async function debugWilson01Ship() {
  const file = 'D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/DM_Wilson_01.png';
  const meta = await sharp(file).metadata();
  const N = 48;
  const { data } = await sharp(file)
    .grayscale()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Let's compute local cross-track and along-track contrast for the ship (r=2..6, c=30..36)
  // vs sand bank (r=38..42, c=29..33)
  console.log('Image dimensions:', meta.width, 'x', meta.height);

  // In DM_Wilson_01, the nadir is cols 19..27 in 48x48 grid.
  // Col 28 has mean ~10, Col 29 has mean ~70, Col 30 has mean ~130.
  // Notice that Col 29-30 is the FIRST BOTTOM RETURN, which extends all the way from row 0 to row 47!
  // It is a vertical line!
  // If we measure: along-track variance or along-track extent of a feature:
  // For any candidate cell (r, c):
  // Check how many rows above and below have similar intensity (along-track continuity).
  // A first bottom return is continuous for almost ALL rows (15..40 rows).
  // A shipwreck, container, or debris only spans 3..8 rows!

  for (const [name, r, c] of [['Ship', 3, 33], ['Sand Bank', 40, 31]]) {
    const val = data[r * N + c];
    // Check along-track (vertical) continuity: how many consecutive rows have intensity within 25% of val?
    let vertCount = 1;
    let up = r - 1;
    while (up >= 0 && Math.abs(data[up * N + c] - val) < 40) { vertCount++; up--; }
    let down = r + 1;
    while (down < N && Math.abs(data[down * N + c] - val) < 40) { vertCount++; down++; }

    // Check distance from nadir track:
    // In 48x48, nadir center is ~23, nadir right edge is col 28.
    const distFromNadir = c - 28;

    // Check high-frequency edge energy (Sobel gradient in original pixels or 64x64):
    console.log(`\nFeature: ${name} at [r=${r}, c=${c}] (val=${val}):`);
    console.log(`  Along-track vertical span: ${vertCount} rows (${(vertCount / N * 100).toFixed(1)}% of swath)`);
    console.log(`  Distance from nadir boundary: ${distFromNadir} cells`);
  }
}

debugWilson01Ship().catch(console.error);
