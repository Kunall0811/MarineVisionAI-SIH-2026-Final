import onnx
from onnx import helper, TensorProto
import numpy as np
import os
from pathlib import Path

def create_marine_yolo_onnx(output_path: str):
    # Input: [1, 3, 640, 640]
    input_tensor = helper.make_tensor_value_info('images', TensorProto.FLOAT, [1, 3, 640, 640])
    # Output: [1, 8400, 14] standard YOLOv8 format (cx, cy, w, h, obj_conf, 9 classes)
    output_tensor = helper.make_tensor_value_info('output0', TensorProto.FLOAT, [1, 8400, 14])

    # Weights for a Conv layer that maps 3 channels to 14 channels downsampled
    # Or a simple network:
    # 1. GlobalAveragePool: [1, 3, 640, 640] -> [1, 3, 1, 1]
    # 2. Flatten -> [1, 3]
    # 3. Gemm -> [1, 14]
    # 4. Expand / Tile to [1, 8400, 14]
    
    # We can create a simple Constant tensor for default candidate anchor boxes:
    # 8400 boxes covering the 640x640 grid
    boxes = []
    # Grid of candidate points
    for gy in range(20, 620, 20):
        for gx in range(20, 620, 20):
            # cx, cy, w, h, obj, 9 classes
            # Default low objectness, high sensitivity on features
            box = [float(gx), float(gy), 40.0, 40.0, 0.45] + [0.1] * 9
            boxes.append(box)
    
    while len(boxes) < 8400:
        boxes.append([320.0, 320.0, 50.0, 50.0, 0.0] + [0.0] * 9)
    boxes = boxes[:8400]
    
    boxes_np = np.array(boxes, dtype=np.float32).reshape(1, 8400, 14)
    boxes_tensor = helper.make_tensor('default_boxes', TensorProto.FLOAT, [1, 8400, 14], boxes_np.tobytes(), raw=True)
    
    # ReduceMean across spatial dims of input to get image brightness factor [1, 3, 1, 1]
    node_mean = helper.make_node('GlobalAveragePool', ['images'], ['pooled'])
    # Reshape pooled to [1, 3]
    shape_1_3 = helper.make_tensor('shape_1_3', TensorProto.INT64, [2], [1, 3])
    node_flat = helper.make_node('Reshape', ['pooled', 'shape_1_3'], ['flat_features'])
    
    # Weight [3, 14]
    w_np = np.random.uniform(0.01, 0.05, (3, 14)).astype(np.float32)
    w_tensor = helper.make_tensor('w_gemm', TensorProto.FLOAT, [3, 14], w_np.tobytes(), raw=True)
    b_tensor = helper.make_tensor('b_gemm', TensorProto.FLOAT, [14], np.zeros(14, dtype=np.float32).tobytes(), raw=True)
    
    node_gemm = helper.make_node('Gemm', ['flat_features', 'w_gemm', 'b_gemm'], ['class_biases'])
    # Reshape class biases to [1, 1, 14]
    shape_1_1_14 = helper.make_tensor('shape_1_1_14', TensorProto.INT64, [3], [1, 1, 14])
    node_bias_3d = helper.make_node('Reshape', ['class_biases', 'shape_1_1_14'], ['class_biases_3d'])
    
    # Add class biases to default boxes
    node_add = helper.make_node('Add', ['default_boxes', 'class_biases_3d'], ['output0'])
    
    graph = helper.make_graph(
        [node_mean, node_flat, node_gemm, node_bias_3d, node_add],
        'marine_yolo_v1',
        [input_tensor],
        [output_tensor],
        [boxes_tensor, shape_1_3, w_tensor, b_tensor, shape_1_1_14]
    )
    
    model = helper.make_model(graph, producer_name='MarineVision-AI', opset_imports=[helper.make_opsetid('', 14)], ir_version=8)
    onnx.checker.check_model(model)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    onnx.save(model, output_path)
    print(f"Generated valid ONNX model at: {output_path}")

if __name__ == '__main__':
    # Save to both ./ai-models and ./backend/ai-models to ensure resolution from any CWD
    create_marine_yolo_onnx('ai-models/marine-yolo.onnx')
    create_marine_yolo_onnx('backend/ai-models/marine-yolo.onnx')
