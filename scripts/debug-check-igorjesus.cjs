const https = require('https');
const url = 'https://img.sofascore.com/api/v1/player/981619/image';
https.get(url, { timeout: 8000 }, res => {
  let len = 0;
  res.on('data', c => len += c.length);
  res.on('end', () => console.log(url, JSON.stringify({ status: res.statusCode, contentType: res.headers['content-type'], bytes: len })));
}).on('error', e => console.log('ERROR', e.message));
