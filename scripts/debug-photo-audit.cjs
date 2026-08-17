const https = require('https');

const players = [
"Lamine Yamal","Jude Bellingham","Pape Gueye","Vinícius Júnior","Kylian Mbappé","Andriy Lunin",
"Ademola Lookman","Jon Martín","Pierre-Emerick Aubameyang","Giovanni Simeone","Sergio Herrera",
"Pau Cubarsí","Isco","Mikel Oyarzabal","Morten Hjulmand","Cucho Hernández","Takefusa Kubo",
"Raphinha","Alex Baena","Nico Williams","Denzel Dumfries","Marc Cucurella","Ander Barrenetxea",
"Jozhua Vertrouwd","José Copete","Germán Parreño","Dávid Hancko","Natan","Carl Starfelt","Padilla",
"Iñaki Williams","Arouna Sangante","Dani Vivian","Pedro Bigas","Chupe","Gabriel Moscardo",
"Renato Veiga","Álvaro García","Leo Román","Carlos Romero","Zaid Romero","Andrei Ratiu","Sergio Carreira"
];

function get(url, headers) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: Object.assign({'User-Agent':'mpg-audit/1.0'}, headers||{}) }, (res) => {
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
  for (let attempt=0; attempt<3; attempt++) {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`;
    const r = await get(url);
    if (r.status === 429) { await sleep(4000); continue; }
    if (r.status !== 200) return {found:false, note:'http'+r.status};
    try {
      const j = JSON.parse(r.body);
      if (!j.player) return {found:false};
      const withPhoto = j.player.filter(p => p.strThumb || p.strCutout);
      return {found: withPhoto.length>0, count: j.player.length, sample: j.player.slice(0,3).map(p=>p.strPlayer+'|'+(p.strTeam||'')+'|'+(p.strNationality||''))};
    } catch(e) { return {found:false, note:'parseerr'}; }
  }
  return {found:false, note:'429_persist'};
}

async function main() {
  const results = {};
  for (const name of players) {
    results[name] = await checkTheSportsDB(name);
    await sleep(2000);
    console.log('DONE', name);
  }
  console.log('=====RESULTS_JSON_START=====');
  console.log(JSON.stringify(results));
  console.log('=====RESULTS_JSON_END=====');
}
main();
