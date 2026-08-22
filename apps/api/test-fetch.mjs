import fetch from 'node-fetch';

async function run() {
  const API_KEY = '199710338e26f2127f7012001e927b4b';
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  const res = await fetch('http://localhost:3000/api/v1/chat/cmt470qcb0001vgbg25x0z1qq/messages', { headers });
  const json = await res.json();
  
  if (json.error) {
    console.error(json.error);
    return;
  }
  
  for (const msg of json.data) {
    console.log(`[${msg.role.toUpperCase()}]`);
    console.log(msg.content);
    console.log('--------------------');
  }
}

run().catch(console.error);
