const { AiInferenceService } = require('./dist/modules/ai-inference/ai-inference.service');

async function testScan() {
  const service = new AiInferenceService({ get: () => null });
  await service.onModuleInit();

  const files = ['DM_Wilson_01.png', 'DM_Wilson_02.png', 'DM_Wilson_03.png', 'DM_Wilson_04.png', 'DM_Wilson_08.png'];
  for (const f of files) {
    const fullPath = `D:/MarineVision-AI-SIH26057-Upgraded/ml/dataset/raw/${f}`;
    const res = await service.analyzeSingleImage(fullPath);
    console.log(`\n=== File: ${f} ===`);
    console.log('  Status:', res.status);
    console.log('  Classification:', res.classification);
    console.log('  Confidence:', res.confidence);
    console.log('  Detections count:', res.detections.length);
    if (res.detections.length > 0) {
      console.log('  Detection[0]:', JSON.stringify(res.detections[0]));
    }
  }
}

testScan().catch(console.error);
