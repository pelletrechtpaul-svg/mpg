const https = require('https');

const urls = {
  'Ganiou': 'https://imgs.search.brave.com/yLr6mNnu9bUbzqBAnn_4c7MI3YHcbNgCG_K9qU3c4aE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9hc3Nl/dHMtZnIuaW1nZm9v/dC5jb20vbWVkaWEv/Y2FjaGUvNjQyeDM4/Mi9kZXNpZ24tc2Fu/cy10aXRyZS0yMDI2/LTA0LTE3dDIyNTM1/Ny0wMzguanBn',
  'Zabarnyi': 'https://imgs.search.brave.com/XaqpKW_YsHhUJKcoR4XTYBA9gxyZ4Ey1j8ZE9LXKDVQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjIy/OTE4Njc2Ni9mci9w/aG90by9wYXJpcy1z/YWludC1nZXJtYWlu/cy11a3JhaW5pYW4t/ZGVmZW5kZXItaWxs/aWEtemFiYXJueWkt/Z2VzdHVyZXMtZHVy/aW5nLXRoZS13YXJt/LXVwLWFoZWFkLW9m/LmpwZz9zPTYxMng2/MTImdz0wJms9MjAm/Yz1QaDlvWWhBdzUy/cFhWWk01cXFtT0JB/ZndJRGhyMDc2Wkt3/UndmT3RSVnpNPQ',
  'Kadioglu': 'https://imgs.search.brave.com/pCdur4bFo0DODwL5d5jQsrXAeSaC33j4Z-Wy244O-D4/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjI2/ODQ4NTcwMS9mci9w/aG90by9pc3RhbmJ1/bC10dXJrZXktZmVy/ZGkta2FkaW9nbHUt/b2YtdHVya2l5ZS1j/ZWxlYnJhdGVzLXNj/b3JpbmctaGlzLXRl/YW1zLWZpcnN0LWdv/YWwtZHVyaW5nLXRo/ZS5qcGc_cz02MTJ4/NjEyJnc9MCZrPTIw/JmM9QXk0WWNnZGpx/SDlWaXZNWXZBb05D/OFlCRGpMQjJOb0FZ/U0R2Q28xTF93ST0',
  'AlyssonEdward': 'https://imgs.search.brave.com/QbIoyHkWuRMF9QNqLLuol6wOh0yjPr7pXmuLkZSfo1s/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly93d3cu/c3BvcnRpbmctaGVy/b2VzLm5ldC9jb250/ZW50L3RodW1ibmFp/bHMvMDA0NzIvNDcx/MTItcHJvZHVjdC5q/cGc',
  'Yildiz': 'https://imgs.search.brave.com/gTGviBy1QWrkpI7hNl1_bFnlfWRrV6LfGIKnoVx3BoE/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjIy/MDc1MzU1MC9mci9w/aG90by9qdXZlbnR1/cy10dXJraXNoLW1p/ZGZpZWxkZXIta2Vu/YW4teWlsZGl6LWNl/bGVicmF0ZXMtc2Nv/cmluZy1oaXMtdGVh/bXMtc2Vjb25kLWdv/YWwtZHVyaW5nLXRo/ZS5qcGc_cz02MTJ4/NjEyJnc9MCZrPTIw/JmM9OXllQXZXWWFt/Q2UzRnZVXzZRZlc3/MU9MYmxDZDJWOGtC/bEFVM2FOaWhlTT0',
  'CarlosAugusto': 'https://imgs.search.brave.com/RLBbVWWwGSHq325_gx4h6a0jzFyblYQ24BqTtJb9oek/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjI0/OTY5NzIzMS9mci9w/aG90by90b3BzaG90/LWludGVyLW1pbGFu/cy1icmF6aWxpYW4t/ZGVmZW5kZXItY2Fy/bG9zLWF1Z3VzdG8t/Y2VsZWJyYXRlcy1z/Y29yaW5nLWhpcy10/ZWFtcy1mb3VydGgu/anBnP3M9NjEyeDYx/MiZ3PTAmaz0yMCZj/PVh4T0lLSUEzbktM/cXVHckVPYUZmZ181/WFludENsazZzRTJh/UE1ZZG15S2c9',
  'Wesley': 'https://imgs.search.brave.com/Ek4oAaVxyieUxbx3dwni-hJUCoFeDuQrrgu45H6wTSQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjI1/MjA4ODA5Ny9waG90/by9yb21lLWl0YWx5/LXdlc2xleS1vZi1y/b21hLWNlbGVicmF0/ZXMtaGlzLWdvYWwt/ZHVyaW5nLXRoZS1z/ZXJpZS1hLW1hdGNo/LWJldHdlZW4tYXMt/cm9tYS1hbmQuanBn/P3M9NjEyeDYxMiZ3/PTAmaz0yMCZjPVRS/LVBsVHJGNi0yUVEy/WEs3ZE1hWEtLbGVD/RE5mT2RUdFprX01f/LXgzSVE9',
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
