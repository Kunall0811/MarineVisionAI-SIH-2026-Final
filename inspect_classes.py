import glob
from collections import Counter
import yaml

counts = Counter()
for split in ['train', 'val', 'test']:
    split_counts = Counter()
    for f in glob.glob(f'datasets/{split}/labels/*.txt'):
        with open(f) as fp:
            for line in fp:
                parts = line.strip().split()
                if parts:
                    split_counts[int(parts[0])] += 1
                    counts[int(parts[0])] += 1
    print(f"{split} class counts:", dict(sorted(split_counts.items())))

print("\nTotal class counts:", dict(sorted(counts.items())))
with open('datasets/dataset.yaml') as fp:
    cfg = yaml.safe_load(fp)
print("Class names mapping:", cfg.get('names'))
