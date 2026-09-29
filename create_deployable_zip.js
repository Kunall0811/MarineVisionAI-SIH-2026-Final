const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const zipPath = path.join(rootDir, 'MarineVisionAI-SIH-2026-Deployable.zip');

console.log('Creating deployable package at:', zipPath);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Build list of items to include
const includes = [
  'backend',
  'frontend',
  'ai-models',
  'datasets',
  'models',
  'reports',
  'docs',
  'docker-compose.yml',
  'README.md',
  'MODEL_CARD.md',
  'PS_COMPLIANCE.md',
  'LICENSE',
];

// We will create a temporary staging directory excluding node_modules
const stagingDir = path.join(rootDir, '.staging_package');
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (base === 'node_modules' || base === '.git' || base === '.staging_package' || base === 'data') {
      return;
    }
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dst, child));
    }
  } else {
    if (src.endsWith('.zip') || src.endsWith('.tar.gz')) return;
    const parent = path.dirname(dst);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

for (const item of includes) {
  const src = path.join(rootDir, item);
  if (fs.existsSync(src)) {
    console.log(`Copying ${item} to staging...`);
    copyRecursive(src, path.join(stagingDir, item));
  }
}

console.log('Compressing staging directory to ZIP...');
try {
  execSync(
    `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command "Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
  const zipStat = fs.statSync(zipPath);
  console.log(`ZIP created successfully: ${zipPath} (${(zipStat.size / (1024 * 1024)).toFixed(2)} MB)`);
} catch (err) {
  console.error('Error creating ZIP:', err.message);
} finally {
  console.log('Cleaning staging directory...');
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
