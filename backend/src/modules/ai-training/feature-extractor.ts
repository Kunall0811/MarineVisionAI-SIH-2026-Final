import sharp from 'sharp';

export const FEATURE_NAMES = [
  'meanIntensity',
  'stdIntensity',
  'edgeDensity',
  'topBottomContrast',
  'leftRightContrast',
  'aspectRatio',
  'brightPixelRatio',
  'darkPixelRatio',
];

/**
 * Computes a fixed-length, hand-crafted feature vector from real pixel data
 * of a (resized, grayscale) sonar image crop. This is the same family of
 * signal (contrast / shadow / edge statistics) already used by the
 * placeholder detector in ai-inference.service.ts, but here it feeds a
 * genuinely trainable classifier rather than a fixed heuristic threshold.
 *
 * This is NOT a substitute for a trained YOLO object detector - it has no
 * notion of bounding boxes. It classifies a whole image/crop into one of
 * the dataset's labelled classes, which is what the Training pipeline in
 * this build can honestly support without an external Python/GPU workflow.
 */
export async function extractFeatures(buffer: Buffer): Promise<number[]> {
  const size = 64;
  const { data, info } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixels = new Float64Array(width * height);
  for (let i = 0; i < pixels.length; i++) pixels[i] = data[i];

  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  const variance = pixels.reduce((a, b) => a + (b - mean) ** 2, 0) / pixels.length;
  const std = Math.sqrt(variance);

  // Sobel-ish gradient magnitude sum as an edge-density proxy.
  let edgeSum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = pixels[idx + 1] - pixels[idx - 1];
      const gy = pixels[idx + width] - pixels[idx - width];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
    }
  }
  const edgeDensity = edgeSum / ((width - 2) * (height - 2) * 255);

  const regionMean = (x1: number, y1: number, x2: number, y2: number) => {
    let sum = 0;
    let count = 0;
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        sum += pixels[y * width + x];
        count++;
      }
    }
    return count ? sum / count : 0;
  };

  const topMean = regionMean(0, 0, width, Math.floor(height / 2));
  const bottomMean = regionMean(0, Math.floor(height / 2), width, height);
  const leftMean = regionMean(0, 0, Math.floor(width / 2), height);
  const rightMean = regionMean(Math.floor(width / 2), 0, width, height);

  const brightCount = pixels.reduce((acc, v) => acc + (v > mean + std ? 1 : 0), 0);
  const darkCount = pixels.reduce((acc, v) => acc + (v < mean - std ? 1 : 0), 0);

  const meta = await sharp(buffer).metadata();
  const aspectRatio = meta.width && meta.height ? meta.width / meta.height : 1;

  return [
    mean / 255,
    std / 255,
    Math.min(1, edgeDensity),
    (topMean - bottomMean) / 255,
    (leftMean - rightMean) / 255,
    Math.min(3, aspectRatio) / 3,
    brightCount / pixels.length,
    darkCount / pixels.length,
  ];
}

/** Real (not fake) image-level augmentation applied only to TRAIN split copies. */
export async function augmentImage(buffer: Buffer, variant: number): Promise<Buffer> {
  const img = sharp(buffer).rotate();
  switch (variant % 4) {
    case 1:
      return img.flop().toBuffer(); // horizontal flip - sonar swath is direction-agnostic
    case 2:
      return img.modulate({ brightness: 1.12 }).toBuffer(); // gain jitter, simulates AGC variation
    case 3:
      return img.modulate({ brightness: 0.9 }).linear(1.05, 0).toBuffer(); // contrast/gain jitter
    default:
      return img.blur(0.4).toBuffer(); // mild speckle smoothing, simulates sensor noise variance
  }
}
