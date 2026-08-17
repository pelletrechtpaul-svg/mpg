const https = require('https');

const players = [
"Rubén Vargas","Anthony Gordon","Federico Valverde","Dani Olmo","Fermín López","Lee Kang-In",
"Thibaut Courtois","Ante Budimir","Rodrigo Riquelme","Bernardo Silva","Eric García","Florian Lejeune",
"Yeremay Hernández","Borja Iglesias","Pedri","Arda Güler","Pablo Gavi","Yan Diomande","Enzo Boyomo",
"Georges Mikautadze","Pablo Fornals","Alexander Sørloth","Ionuț Radu","Karl Etta Eyong","Andrés Martín",
"Tajon Buchanan","Mikel Jauregizar","Angeliño","Unai Simón","Alejandro Grimaldo","Héctor Bellerín",
"Antony","Antonio Rüdiger","Karim Adeyemi","Lamine Yamal","Jude Bellingham","Pape Gueye",
"Vinícius Júnior","Kylian Mbappé","Andriy Lunin","Ademola Lookman","Jon Martín",
"Pierre-Emerick Aubameyang","Giovanni Simeone","Sergio Herrera","Pau Cubarsí","Isco","Mikel Oyarzabal",
"Morten Hjulmand","Cucho Hernández","Takefusa Kubo","Raphinha","Alex Baena","Nico Williams",
"Denzel Dumfries","Marc Cucurella","Ander Barrenetxea","Jozhua Vertrouwd","José Copete",
"Germán Parreño","Dávid Hancko","Natan","Carl Starfelt","Padilla","Iñaki Williams","Arouna Sangante",
"Dani Vivian","Pedro Bigas","Chupe","Gabriel Moscardo","Renato Veiga","Álvaro García","Leo Román",
"Carlos Romero","Zaid Romero","Andrei Ratiu","Sergio Carreira"
];

function get(url, headers) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: Object.assign({'User-Agent':'mpg-audit/1.0 (contact: test@example.com)'}, headers||{}) }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({status: res.statusCode, body: data}));
    });
    req.on('error', (e) => resolve({status: 0, body: '', error: e.message}));
    req.setTimeout(15000, () => { req.destroy(); resolve({status: 0, body: '', error: 'timeout'}); });
  });
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function checkTheSportsDB(name) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`;
  const r = await get(url);
  if (r.status !== 200) return {found:false, note:'http'+r.status};
  try {
    const j = JSON.parse(r.body);
    if (!j.player) return {found:false};
    const withPhoto = j.player.filter(p => p.strThumb || p.strCutout);
    return {found: withPhoto.length>0, count: j.player.length, sample: j.player.slice(0,3).map(p=>p.strPlayer+'|'+(p.strTeam||'')+'|'+(p.strNationality||''))};
  } catch(e) { return {found:false, note:'parseerr'}; }
}

async function checkWikipedia(name) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name+' footballer')}&format=json&srlimit=3`;
  const r = await get(url);
  if (r.status !== 200) return {found:false, note:'http'+r.status};
  try {
    const j = JSON.parse(r.body);
    const results = (j.query && j.query.search) || [];
    if (!results.length) return {found:false};
    const title = results[0].title;
    const url2 = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=200`;
    const r2 = await get(url2);
    let hasImage = false;
    try {
      const j2 = JSON.parse(r2.body);
      const pages = j2.query.pages;
      for (const k in pages) if (pages[k].thumbnail) hasImage = true;
    } catch(e){}
    return {found: hasImage, title, note: hasImage? '' : 'nopageimage'};
  } catch(e) { return {found:false, note:'parseerr'}; }
}

async function main() {
  const results = {thesportsdb:{}, wikipedia:{}};
  for (const name of players) {
    results.thesportsdb[name] = await checkTheSportsDB(name);
    await sleep(150);
    results.wikipedia[name] = await checkWikipedia(name);
    await sleep(150);
    console.log('DONE', name);
  }
  console.log('=====RESULTS_JSON_START=====');
  console.log(JSON.stringify(results));
  console.log('=====RESULTS_JSON_END=====');
}

main();
