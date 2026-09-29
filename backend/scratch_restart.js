const { execSync } = require('child_process');

try {
  const netstat = execSync('netstat -ano').toString();
  const lines = netstat.split('\n').filter(l => l.includes(':4000') && l.includes('LISTENING'));
  console.log('Listening on 4000:', lines);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0' && pid !== String(process.pid)) {
      console.log('Killing PID:', pid);
      try {
        execSync(`taskkill /F /PID ${pid}`);
      } catch (e) {
        console.log('Error killing:', e.message);
      }
    }
  }
} catch (e) {
  console.error(e);
}
