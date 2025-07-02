const { get: https_get } = require('https');

// Test basic HTTPS connectivity
const testUrl = 'https://www.theguardian.com/uk';

console.log('Testing basic HTTPS connectivity...');

const req = https_get(testUrl, {
  headers: {
    'User-Agent': 'Node.js Test',
    'Connection': 'close'
  }
}, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.setEncoding('utf8');
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response received successfully');
    console.log('Response length:', data.length);
    console.log('First 200 chars:', data.substring(0, 200));
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.on('socket', (socket) => {
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  socket.on('close', () => {
    console.log('Socket closed');
  });
});

req.setTimeout(10000, () => {
  console.log('Request timeout');
  req.destroy();
});

req.end();
