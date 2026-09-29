const net = require('net');
const client = net.createConnection({ port: 6379, host: '127.0.0.1', timeout: 2000 }, () => {
  console.log('REDIS IS RUNNING AND CONNECTED!');
  client.end();
});
client.on('error', (err) => console.log('REDIS ERROR:', err.message));
client.on('timeout', () => {
  console.log('REDIS TIMEOUT');
  client.destroy();
});
