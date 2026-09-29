const fs = require('fs');
const path = require('path');
const p1 = path.resolve(process.cwd(), 'reports', 'metrics.json');
const p2 = path.resolve(process.cwd(), '..', 'reports', 'metrics.json');
console.log('p1:', p1, fs.existsSync(p1));
console.log('p2:', p2, fs.existsSync(p2));
