import http from 'node:http';

function checkHealth(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function testConnection() {
  console.log('Testing connection to http://127.0.0.1:3000/api/v1/health...');
  try {
    const res = await checkHealth('http://127.0.0.1:3000/api/v1/health');
    console.log('✅ API Health Check Successful:', res);
  } catch (err) {
    console.log('❌ API Health Check Connection Failed:', err.message);
  }
}

testConnection();
