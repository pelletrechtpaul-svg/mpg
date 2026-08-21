const https = require('https');

const urls = {
  'Ganiou_KNOWN_PLACEHOLDER': 'https://img.sofascore.com/api/v1/player/1408080/image',
  'Kadioglu': 'https://img.sofascore.com/api/v1/player/825844/image',
  'AlyssonEdward': 'https://img.sofascore.com/api/v1/player/1631879/image',
  'Wesley': 'https://img.sofascore.com/api/v1/player/1134200/image',
};

function fetchBuf(url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 8000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

// Parse WebP dimensions from VP8/VP8L/VP8X chunk
function webpDims(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { w, h };
  }
  if (fourcc === 'VP8 ') {
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    return { w, h };
  }
  return { note: 'VP8L or unknown, fourcc=' + fourcc };
}

async function main() {
  for (const [name, url] of Object.entries(urls)) {
    const buf = await fetchBuf(url);
    if (!buf) { console.log(name, 'FETCH FAILED'); continue; }
    console.log(name, url, 'bytes=' + buf.length, JSON.stringify(webpDims(buf)));
    await new Promise(r => setTimeout(r, 500));
  }
}
main();
