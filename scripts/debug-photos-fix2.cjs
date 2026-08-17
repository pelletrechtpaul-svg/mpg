const https = require('https');

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'MesPetitsBavons/1.0 (private fantasy football app; contact: n/a)', 'Accept': 'application/json' },
      timeout: 8000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', () => resolve(null)).on('timeout', () => resolve(null));
  });
}

async function wikiPhoto(query) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
  const s = await fetchJson(searchUrl);
  const title = s?.query?.search?.[0]?.title;
  if (!title) return { title: null, photo: null };
  const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const sum = await fetchJson(sumUrl);
  return { title, photo: sum?.originalimage?.source || sum?.thumbnail?.source || null, type: sum?.type };
}

async function main() {
  for (const q of ['Gavi footballer Barcelona', 'Gabriel Moscardo footballer Reims']) {
    const r = await wikiPhoto(q);
    console.log(`${q} -> title="${r.title}" type=${r.type} photo=${r.photo}`);
    await new Promise(res => setTimeout(res, 500));
  }
}
main();
