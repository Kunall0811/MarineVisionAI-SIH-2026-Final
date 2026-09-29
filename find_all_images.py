import glob
import os

dirs = ['ml/dataset/raw', 'backend/sonar-storage', 'datasets']
for d in dirs:
    pngs = glob.glob(f'{d}/**/*.png', recursive=True)
    jpgs = glob.glob(f'{d}/**/*.jpg', recursive=True) + glob.glob(f'{d}/**/*.jpeg', recursive=True)
    print(f'{d}: {len(pngs)} PNGs, {len(jpgs)} JPGs')

# Also check unique files in backend/sonar-storage
storage_pngs = glob.glob('backend/sonar-storage/**/*.png', recursive=True)
print(f"\nTotal storage files: {len(storage_pngs)}")
# Show 10 sample names
for p in storage_pngs[:10]:
    print(" ", p, os.path.getsize(p))
