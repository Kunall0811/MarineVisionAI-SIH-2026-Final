const http = require('http');
http.get('http://localhost:4000/api/model/metrics', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('METRICS RESULT:', data));
});
