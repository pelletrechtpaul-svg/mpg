const https = require('https');

const urls = {
  'Abner': 'https://media.gettyimages.com/id/2171889129/fr/photo/lens-abner-vinicius-of-olympique-lyonnais-during-the-french-ligue-1-match-between-rc-lens-and.jpg?s=612x612&w=0&k=20&c=JdwDLrKRrsPodpfaGVCnP1CS704DxLlp26U7dJCvac8=',
  'IgorJesus': 'https://imgs.search.brave.com/LiJNcRP930aIZXwNOWae5ZjhOLkPXImkmGkz1lm5U5U/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjE4/MDgzNDA2MC9waG90/by9yaW8tZGUtamFu/ZWlyby1icmF6aWwt/aWdvci1qZXN1cy1v/Zi1ib3RhZm9nby1j/ZWxlYnJhdGVzLWFm/dGVyLXNjb3Jpbmct/dGhlLXRlYW1zLWZp/ZnRoLWdvYWwuanBn/P3M9NjEyeDYxMiZ3/PTAmaz0yMCZjPUJu/bzFYbkdMbTk2TXNz/ZTlYRS1tZ2xqakpa/azRDd3NQczRFa3Vz/UGNna009',
};

function check(url) {
  return new Promise(resolve => {
    https.get(url, { timeout: 10000 }, res => {
      let len = 0;
      res.on('data', c => len += c.length);
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], bytes: len }));
    }).on('error', e => resolve({ error: e.message })).on('timeout', () => resolve({ error: 'timeout' }));
  });
}

async function main() {
  for (const [name, url] of Object.entries(urls)) {
    const r = await check(url);
    console.log(name, JSON.stringify(r));
  }
}
main();
