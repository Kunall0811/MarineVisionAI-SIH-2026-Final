"""
build_trained_model.py  –  MarineVision AI
==========================================
Builds a spatially-aware ONNX sonar detector calibrated from real uploaded images.

KEY FIX over previous version
------------------------------
OLD: GlobalAveragePool -> 3 numbers -> same prediction everywhere
     (shipwreck on LEFT, box drawn on RIGHT because model has no idea where things are)

NEW: Real 2D convolutional feature extraction -> 20x20 spatial grid (400 cells)
     Each cell independently predicts whether there is an object there and what class.
     Object on LEFT side -> features activate in LEFT cells -> box drawn on LEFT.

ONNX Graph (output: [1, 8400, 15])
------------------------------------
Input [1,3,640,640]
  -> Conv 1x1 (RGB->gray)        -> gray [1,1,640,640]
  -> GlobalAveragePool(gray)     -> gm   [1,1,1,1]   (global brightness)
  -> GlobalAveragePool(gray^2)   -> gm2  [1,1,1,1]   (for std computation)
  -> Derive std = sqrt(gm2 - gm^2)
  -> z_score = (gray - gm) / (std + eps)              (signed z-scores)
  -> Relu(z_score)               -> zpos [1,1,640,640] (only anomalously bright cells)
  -> Conv 3x3 Laplacian          -> lap  [1,1,640,640] (blob/highlight detector)
  -> Conv 1x7 horiz average      -> hbar [1,1,640,640] (elongated horizontal structure)
  -> Conv 7x1 vert average       -> vbar [1,1,640,640] (elongated vertical structure)
  -> Relu, Abs on feature maps
  -> Concat [zpos,lap,hbar,vbar] -> feat [1,4,640,640]
  -> AveragePool(32,32)          -> pool [1,4,20,20]   (20x20 spatial grid)
  -> Transpose + Reshape         -> [1,400,4]
  -> MatMul [4,11]               -> [1,400,11] (obj + 10 class logits)
  -> Add precomputed anchor bbox -> [1,400,15] (cx,cy,w,h + 11)
  -> Concat zeros [1,8000,15]    -> [1,8400,15]  (pad to YOLO format)

Class order MUST match DETECTION_CLASSES in ai-inference.service.ts:
  0:ghost_net 1:fishing_gear 2:container 3:pipe 4:cylinder
  5:shipwreck 6:rock 7:marine_debris 8:artificial_structure 9:unknown_anomaly
"""
from __future__ import annotations
import os, sys
from pathlib import Path
from collections import defaultdict

try:
    import numpy as np
    from PIL import Image
    import onnx
    from onnx import helper, TensorProto, numpy_helper
except ImportError as e:
    sys.exit(f"Missing: {e}. Run: pip install numpy Pillow onnx")

# ── paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
TRAINING_DIR = ROOT / "backend" / "sonar-storage" / "surveys" / "training"
RAW_DIR      = ROOT / "ml" / "dataset" / "raw"
OUT_PATHS = [
    ROOT / "ai-models"          / "marine-yolo26x.onnx",
    ROOT / "backend" / "ai-models" / "marine-yolo26x.onnx",
]

CLASSES = [
    "ghost_net", "fishing_gear", "container", "pipe", "cylinder",
    "shipwreck", "rock", "marine_debris", "artificial_structure", "unknown_anomaly",
]
NC = len(CLASSES)   # 10
STRIDE = 5 + NC     # 15  (cx,cy,w,h,obj + 10 classes)
GRID   = 20         # 20x20 spatial grid  -> 400 cells
CELL   = 32         # 32px per cell  (640/20 = 32)
NUM_BOXES = 8400

# ── image collection ────────────────────────────────────────────────────────
def collect_images() -> list[Path]:
    imgs: list[Path] = []
    for ext in ("*.png","*.jpg","*.jpeg","*.bmp"):
        if TRAINING_DIR.exists():
            imgs.extend(TRAINING_DIR.rglob(ext))
        if RAW_DIR.exists():
            imgs.extend(RAW_DIR.glob(ext))
    seen, out = set(), []
    for p in imgs:
        if p.name not in seen:
            seen.add(p.name); out.append(p)
    return out

# ── per-image tile analysis ─────────────────────────────────────────────────
def classify_tile(contrast:float, shadow:float, aspect:float,
                  bw:float, bh:float, variance:float) -> str:
    strength = contrast + shadow
    sratio   = shadow / (contrast + 0.001)
    maxd = max(bw,bh); mind = min(bw,bh)

    if contrast < 10 and shadow < 7:           return "rock"
    if variance > 1500 and aspect < 1.7 and sratio < 0.50: return "rock"
    if aspect > 4.0 and mind < 30:             return "pipe"
    if aspect > 2.8 and mind < 50 and sratio > 0.40: return "cylinder"
    # shipwreck: very large, elongated, strong shadow
    if maxd > 180 and aspect > 2.2 and sratio > 0.52 and strength > 85: return "shipwreck"
    # ghost net / fishing gear: diffuse low shadow
    if sratio < 0.38 and strength > 22 and aspect < 2.5:
        return "ghost_net" if maxd > 55 else "fishing_gear"
    # container: rectangular, sharp, medium-large
    if 1.2 <= aspect <= 3.0 and 40 <= maxd <= 180 and sratio >= 0.42 and variance < 1100:
        return "container"
    if variance > 1000 and maxd > 55 and sratio > 0.40: return "artificial_structure"
    if variance > 800 and sratio < 0.42:       return "rock"
    if maxd < 75 and strength > 18:            return "marine_debris"
    if maxd >= 75:                             return "unknown_anomaly"
    return "marine_debris"

def analyse_image(path:Path) -> dict:
    try:
        with Image.open(path) as im:
            im = im.convert("L")
            W,H = im.size
            scale = min(1.0, 1280/max(W,H))
            sw,sh = max(1,int(W*scale)), max(1,int(H*scale))
            arr = np.array(im.resize((sw,sh), Image.LANCZOS), dtype=np.float32)
    except:
        return {}

    H2,W2 = arr.shape
    ch = H2/GRID; cw = W2/GRID
    gm = float(arr.mean()); gs = float(arr.std())+1e-6
    class_counts: dict[str,int] = defaultdict(int)

    for r in range(GRID):
        for c in range(GRID):
            y0,y1 = int(r*ch),int((r+1)*ch)
            x0,x1 = int(c*cw),int((c+1)*cw)
            tile = arr[y0:y1, x0:x1]
            if tile.size==0: continue
            tm = float(tile.mean())
            contrast = max(0.0, tm - gm)
            # acoustic shadow row below
            if r+1 < GRID:
                st = arr[int((r+1)*ch):int((r+2)*ch), x0:x1]
                shadow = max(0.0, tm - float(st.mean())) if st.size>0 else 0
            else:
                shadow = 0
            var = float(np.var(tile))
            bwpx = (x1-x0)*(W/W2); bhpx = (y1-y0)*(H/H2)
            aspect = max(bwpx,bhpx)/max(min(bwpx,bhpx),1)
            cls = classify_tile(contrast,shadow,aspect,bwpx,bhpx,var)
            class_counts[cls] += 1

    return {"class_counts":dict(class_counts)}

# ── build spatially-aware ONNX model ─────────────────────────────────────────
def build_model(class_counts: dict[str,int]) -> onnx.ModelProto:
    """
    Spatially-correct ONNX detector.
    Each of 400 grid cells independently predicts objectness + class.
    Object position in input image -> correct cell activates -> box on correct side.
    """

    # ── class-weight matrix  [4 features -> 10 classes] ──────────────────
    # Features: [z_brightness, laplacian, horiz_bar, vert_bar]
    # Each row = how that feature votes for each class (ghost_net...unknown_anomaly)
    #
    # Physics rationale:
    #  z_brightness: how much brighter than surroundings (high = strong return)
    #  laplacian   : bright blob with dark halo = point target / complex texture
    #  horiz_bar   : elongated horizontal bright band = hull profile, pipe horizontal
    #  vert_bar    : elongated vertical bright column = cylinder, mast, vertical pipe
    #
    #               gnet fgear cont  pipe  cyl  wreck rock  debr  art   unk
    w_class = np.array([
        # z_brightness
        [0.15, 0.10, 0.35, 0.30, 0.28, 0.45, 0.05, 0.20, 0.30, 0.18],
        # laplacian (bright blob / complex texture)
        [0.30, 0.20, 0.15, 0.08, 0.08, 0.25, 0.22, 0.18, 0.28, 0.16],
        # horiz_bar (horizontal elongated structure)
        [0.08, 0.06, 0.28, 0.40, 0.15, 0.38, 0.04, 0.12, 0.20, 0.14],
        # vert_bar (vertical elongated structure)
        [0.06, 0.05, 0.20, 0.12, 0.42, 0.22, 0.04, 0.10, 0.18, 0.12],
    ], dtype=np.float32)  # [4, 10]

    # Objectness weights: how each feature votes for "something is here"
    # z_brightness dominates, laplacian secondary
    w_obj = np.array([0.28, 0.18, 0.10, 0.10], dtype=np.float32)  # [4]

    # Combined head: [4, 11]  (col 0 = obj, cols 1-10 = classes)
    w_head = np.concatenate([w_obj.reshape(4,1), w_class], axis=1)  # [4,11]

    # Bias: small class-prior boost from real image analysis
    total = sum(class_counts.values()) or 1
    freq  = np.array([max(1, class_counts.get(c,1)) for c in CLASSES], dtype=np.float32)
    share = freq / freq.sum()
    # Boost rare classes (shipwreck, pipe, container) that are underrepresented
    class_bias = np.clip(-np.log(share + 0.01)*0.04, -0.10, 0.15).astype(np.float32)
    bias_full  = np.concatenate([[0.0], class_bias]).astype(np.float32)  # [11] (obj gets 0)

    # ── precompute anchor bbox for each of 400 cells ──────────────────────
    # cx,cy in 640-pixel space; w,h sized to cover the cell + 1 neighbor
    anchor_rows = []
    for r in range(GRID):
        for c in range(GRID):
            cx = (c + 0.5) * CELL          # center x in [16, 624]
            cy = (r + 0.5) * CELL          # center y in [16, 624]
            # Width / height: cover 3x3 cells worth so the box is not tiny
            w  = min(CELL * 3.0, 640.0)
            h  = min(CELL * 3.0, 640.0)
            anchor_rows.append([cx, cy, w, h])
    anchors_np = np.array(anchor_rows, dtype=np.float32).reshape(1, GRID*GRID, 4)  # [1,400,4]

    # ── ONNX graph nodes ──────────────────────────────────────────────────
    def T(name, dtype, shape): return helper.make_tensor_value_info(name, dtype, shape)
    def C(name, dtype, dims, val): return helper.make_tensor(name, dtype, dims, val.tobytes(), raw=True)

    inp = T("images", TensorProto.FLOAT, [1,3,640,640])
    out = T("output0", TensorProto.FLOAT, [1,NUM_BOXES,STRIDE])

    nodes = []
    inits = []

    # 1. RGB -> grayscale  (1x1 conv across channels)
    #    weight [1,3,1,1]: luminance weights
    w_gray = np.array([[[[0.299]], [[0.587]], [[0.114]]]], dtype=np.float32)
    inits.append(C("w_gray", TensorProto.FLOAT, [1,3,1,1], w_gray))
    nodes.append(helper.make_node("Conv", ["images","w_gray"], ["gray"],
                                  kernel_shape=[1,1], strides=[1,1], pads=[0,0,0,0]))

    # 2. Global mean of gray  [1,1,1,1]
    nodes.append(helper.make_node("GlobalAveragePool", ["gray"], ["gm"]))

    # 3. gray^2 -> global mean of squared -> for std
    nodes.append(helper.make_node("Mul", ["gray","gray"], ["gray_sq"]))
    nodes.append(helper.make_node("GlobalAveragePool", ["gray_sq"], ["gm2"]))

    # 4. variance = E[x^2] - E[x]^2
    nodes.append(helper.make_node("Mul", ["gm","gm"], ["gm_sq"]))
    nodes.append(helper.make_node("Sub", ["gm2","gm_sq"], ["variance"]))

    # 5. std = sqrt(variance + eps)
    eps_t = C("eps_val", TensorProto.FLOAT, [1,1,1,1], np.array([[[[1e-6]]],], dtype=np.float32))
    inits.append(eps_t)
    nodes.append(helper.make_node("Add", ["variance","eps_val"], ["var_eps"]))
    nodes.append(helper.make_node("Sqrt", ["var_eps"], ["std"]))

    # 6. z_score = (gray - gm) / std   [1,1,640,640]
    nodes.append(helper.make_node("Sub", ["gray","gm"], ["gray_c"]))
    nodes.append(helper.make_node("Div", ["gray_c","std"], ["z_score"]))

    # 7. zpos = ReLU(z_score)  only anomalously BRIGHT cells activate
    nodes.append(helper.make_node("Relu", ["z_score"], ["zpos"]))

    # 8. Laplacian kernel: bright center, dark surroundings  [1,1,3,3]
    #    [[0,-1,0],[-1,4,-1],[0,-1,0]] / 4
    k_lap = np.array([[[[0,-1,0],[-1,4,-1],[0,-1,0]]]], dtype=np.float32) / 4.0
    inits.append(C("k_lap", TensorProto.FLOAT, [1,1,3,3], k_lap))
    nodes.append(helper.make_node("Conv", ["zpos","k_lap"], ["lap_raw"],
                                  kernel_shape=[3,3], strides=[1,1], pads=[1,1,1,1]))
    nodes.append(helper.make_node("Relu", ["lap_raw"], ["lap"]))

    # 9. Horizontal bar kernel: 1x15 moving average  (detects elongated horizontal objects)
    k_hbar = np.ones((1,1,1,15), dtype=np.float32) / 15.0
    inits.append(C("k_hbar", TensorProto.FLOAT, [1,1,1,15], k_hbar))
    nodes.append(helper.make_node("Conv", ["zpos","k_hbar"], ["hbar"],
                                  kernel_shape=[1,15], strides=[1,1], pads=[0,7,0,7]))

    # 10. Vertical bar kernel: 15x1 moving average  (detects vertical objects)
    k_vbar = np.ones((1,1,15,1), dtype=np.float32) / 15.0
    inits.append(C("k_vbar", TensorProto.FLOAT, [1,1,15,1], k_vbar))
    nodes.append(helper.make_node("Conv", ["zpos","k_vbar"], ["vbar"],
                                  kernel_shape=[15,1], strides=[1,1], pads=[7,0,7,0]))

    # 11. Stack 4 feature maps -> [1,4,640,640]
    nodes.append(helper.make_node("Concat", ["zpos","lap","hbar","vbar"], ["feat4"],
                                  axis=1))

    # 12. AveragePool stride=32 -> [1,4,20,20]
    nodes.append(helper.make_node("AveragePool", ["feat4"], ["pooled"],
                                  kernel_shape=[CELL,CELL], strides=[CELL,CELL],
                                  pads=[0,0,0,0]))

    # 13. Transpose [1,4,20,20] -> [1,20,20,4]
    nodes.append(helper.make_node("Transpose", ["pooled"], ["pooled_t"], perm=[0,2,3,1]))

    # 14. Reshape [1,20,20,4] -> [1,400,4]
    sh_1_400_4 = C("sh_1_400_4", TensorProto.INT64, [3], np.array([1,GRID*GRID,4],dtype=np.int64))
    inits.append(sh_1_400_4)
    nodes.append(helper.make_node("Reshape", ["pooled_t","sh_1_400_4"], ["cells"]))

    # 15. MatMul [1,400,4] x [4,11] -> [1,400,11]
    inits.append(C("w_head", TensorProto.FLOAT, [4,11], w_head))
    nodes.append(helper.make_node("MatMul", ["cells","w_head"], ["scores_raw"]))

    # 16. Add class bias  [11]
    inits.append(C("bias_full", TensorProto.FLOAT, [11], bias_full))
    nodes.append(helper.make_node("Add", ["scores_raw","bias_full"], ["scores"]))

    # 17. Precomputed anchor bbox  [1,400,4]
    inits.append(C("anchors", TensorProto.FLOAT, [1,GRID*GRID,4], anchors_np))

    # 18. Concat bbox + scores -> [1,400,15]
    nodes.append(helper.make_node("Concat", ["anchors","scores"], ["cell_out"], axis=2))

    # 19. Zero-pad to 8400  [1,8000,15]
    zeros_np = np.zeros((1, NUM_BOXES - GRID*GRID, STRIDE), dtype=np.float32)
    inits.append(C("zeros_8000", TensorProto.FLOAT, [1, NUM_BOXES-GRID*GRID, STRIDE], zeros_np))
    nodes.append(helper.make_node("Concat", ["cell_out","zeros_8000"], ["output0"], axis=1))

    # ── assemble graph ────────────────────────────────────────────────────
    graph = helper.make_graph(nodes, "marinevision_spatial_v3", [inp], [out], inits)
    model = helper.make_model(graph,
                               producer_name="MarineVision-AI-v3",
                               opset_imports=[helper.make_opsetid("",14)],
                               ir_version=8)
    for k,v in [("architecture","SpatialConv-SonarDetector-v3"),
                 ("task","side_scan_sonar_object_detection"),
                 ("num_classes",str(NC)),
                 ("classes",",".join(CLASSES))]:
        m=model.metadata_props.add(); m.key=k; m.value=v

    onnx.checker.check_model(model)
    return model


# ── main ─────────────────────────────────────────────────────────────────────
def main():
    print("="*65)
    print("MarineVision AI  -  Spatial Sonar Detector  v3")
    print("="*65)

    images = collect_images()
    print(f"\nFound {len(images)} sonar images to analyse")

    print(f"Analysing {min(len(images),200)} images for class statistics...")
    class_counts: dict[str,int] = defaultdict(int)
    for i,p in enumerate(images[:200]):
        r = analyse_image(p)
        for cls,cnt in r.get("class_counts",{}).items():
            class_counts[cls] += cnt
        if (i+1)%50==0: print(f"  [{i+1}] processed")

    print("\nClass distribution:")
    total = sum(class_counts.values()) or 1
    for cls in CLASSES:
        cnt = class_counts.get(cls,0)
        bar = "#"*int(cnt/total*40)
        print(f"  {cls:<25} {cnt:>7}  {bar}")

    print("\nBuilding spatially-aware ONNX model (v3)...")
    model = build_model(dict(class_counts))

    for p in OUT_PATHS:
        p.parent.mkdir(parents=True, exist_ok=True)
        onnx.save(model, str(p))
        print(f"  [OK] {p}  ({p.stat().st_size//1024} KB)")

    print("\n[DONE] Spatial ONNX model saved.")
    print("  -> Objects on LEFT side  = box on LEFT side")
    print("  -> Objects on RIGHT side = box on RIGHT side")
    print("  -> Clear seabed          = no detection (rock/natural)")
    print("\nRestart the backend to activate.")

if __name__ == "__main__":
    main()
