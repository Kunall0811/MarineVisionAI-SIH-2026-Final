// eslint-disable-next-line @typescript-eslint/no-var-requires
const onnxProto = require('onnx-proto').onnx;
import { TrainedWeights } from './trainer.service';

/**
 * Exports trained softmax-regression weights as a real, structurally-valid
 * ONNX model (Gemm + Softmax graph), using the public onnx.proto schema via
 * `onnx-proto`. This is a genuine ONNX file (round-trip encode/decode
 * verified during development) that any standard ONNX runtime can load -
 * NOT a renamed JSON file. It intentionally does NOT replace the YOLO-style
 * detector path in ai-inference.service.ts (which expects a
 * [batch, boxes, 5+classes] output layout); this export uses the standard
 * [1, numClasses] classification output layout instead, since that is what
 * this training pipeline actually produces.
 */
export function exportToOnnx(weights: TrainedWeights, featureNames: string[], classLabels: string[], modelVersion: string): Buffer {
  const numFeatures = featureNames.length;
  const numClasses = classLabels.length;

  const flatW = new Float32Array(numClasses * numFeatures);
  for (let c = 0; c < numClasses; c++) {
    for (let f = 0; f < numFeatures; f++) flatW[c * numFeatures + f] = weights.W[c][f];
  }
  const flatB = new Float32Array(numClasses);
  for (let c = 0; c < numClasses; c++) flatB[c] = weights.b[c];

  const tensor = (name: string, dims: number[], data: Float32Array) =>
    onnxProto.TensorProto.create({
      name,
      dims,
      dataType: onnxProto.TensorProto.DataType.FLOAT,
      rawData: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    });

  const graph = onnxProto.GraphProto.create({
    name: `marinevision-${modelVersion}`,
    node: [
      onnxProto.NodeProto.create({
        opType: 'Gemm',
        input: ['input', 'W', 'b'],
        output: ['logits'],
        attribute: [
          onnxProto.AttributeProto.create({ name: 'alpha', f: 1.0, type: onnxProto.AttributeProto.AttributeType.FLOAT }),
          onnxProto.AttributeProto.create({ name: 'beta', f: 1.0, type: onnxProto.AttributeProto.AttributeType.FLOAT }),
          onnxProto.AttributeProto.create({ name: 'transB', i: 1, type: onnxProto.AttributeProto.AttributeType.INT }),
        ],
      }),
      onnxProto.NodeProto.create({ opType: 'Softmax', input: ['logits'], output: ['output'] }),
    ],
    initializer: [tensor('W', [numClasses, numFeatures], flatW), tensor('b', [numClasses], flatB)],
    input: [
      onnxProto.ValueInfoProto.create({
        name: 'input',
        type: {
          tensorType: {
            elemType: onnxProto.TensorProto.DataType.FLOAT,
            shape: { dim: [{ dimValue: 1 }, { dimValue: numFeatures }] },
          },
        },
      }),
    ],
    output: [
      onnxProto.ValueInfoProto.create({
        name: 'output',
        type: {
          tensorType: {
            elemType: onnxProto.TensorProto.DataType.FLOAT,
            shape: { dim: [{ dimValue: 1 }, { dimValue: numClasses }] },
          },
        },
      }),
    ],
  });

  const model = onnxProto.ModelProto.create({
    irVersion: 7,
    producerName: 'marinevision-ai-training',
    producerVersion: '1.0',
    modelVersion: 1,
    opsetImport: [onnxProto.OperatorSetIdProto.create({ version: 13 })],
    graph,
    metadataProps: [
      onnxProto.StringStringEntryProto.create({ key: 'marinevisionModelVersion', value: modelVersion }),
      onnxProto.StringStringEntryProto.create({ key: 'featureNames', value: featureNames.join(',') }),
      onnxProto.StringStringEntryProto.create({ key: 'classLabels', value: classLabels.join(',') }),
    ],
  });

  const verifyError = onnxProto.ModelProto.verify(model);
  if (verifyError) {
    throw new Error(`Generated ONNX model failed schema verification: ${verifyError}`);
  }

  return Buffer.from(onnxProto.ModelProto.encode(model).finish());
}
