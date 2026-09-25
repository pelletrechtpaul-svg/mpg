// Read-only diagnostic for the undocumented MPG API. It deliberately logs
// response shapes only; never response values, credentials, cookies, or tokens.

const MPG_WEB = 'https://mpg.football';
const CONNECT = 'https://connect.ligue1.fr';
const API = 'https://api.mpg.football';

function cookiesFrom(response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((cookie) => cookie.split(';', 1)[0]).filter(Boolean).join('; ');
}

function readCookie(cookieHeader, name) {
  const prefix = `${name}=`;
  return cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length);
}

async function getWithCookies(url, cookieHeader = '') {
  const headers = cookieHeader ? { Cookie: cookieHeader } : {};
  const response = await fetch(url, { headers, redirect: 'manual' });
  return { response, cookies: cookiesFrom(response) };
}

async function authenticateOidc(email, password) {
  const amplitudeId = crypto.randomUUID();
  const params = new URLSearchParams({
    _data: 'routes/__home/__auth/auth',
    'ext-amplitudeId': amplitudeId,
  });
  const first = await fetch(`${MPG_WEB}/auth?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }),
    redirect: 'manual',
  });
  const initialCookies = cookiesFrom(first);
  const redirectHeader = first.headers.get('x-remix-redirect');
  if (!redirectHeader) throw new Error(`OIDC step 1 failed (HTTP ${first.status})`);

  const startUrl = new URL(redirectHeader.replace('ext-amplitudeId=', `ext-amplitudeId=${amplitudeId}`), MPG_WEB);
  const step2 = await getWithCookies(startUrl);
  const loginUrlHeader = step2.response.headers.get('location');
  if (step2.response.status !== 302 || !loginUrlHeader) throw new Error(`OIDC step 2 failed (HTTP ${step2.response.status})`);

  const loginUrl = new URL(loginUrlHeader, CONNECT);
  const state = loginUrl.searchParams.get('state');
  if (!state) throw new Error('OIDC state missing');

  const step3 = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(step2.cookies ? { Cookie: step2.cookies } : {}),
    },
    body: new URLSearchParams({ state, username: email, password }),
    redirect: 'manual',
  });
  const resumeHeader = step3.headers.get('location');
  if (!resumeHeader) throw new Error(`OIDC step 3 failed (HTTP ${step3.status})`);

  const resumeUrl = new URL(resumeHeader, CONNECT);
  const step4 = await getWithCookies(resumeUrl, cookiesFrom(step3));
  const resumeBody = await step4.response.text();
  const codeMatch = resumeBody.match(/name="code"\s+value="([^"]+)"/);
  if (!codeMatch) throw new Error(`OIDC authorization code missing (HTTP ${step4.response.status})`);

  const callback = await fetch(`${MPG_WEB}/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(initialCookies ? { Cookie: initialCookies } : {}),
    },
    body: new URLSearchParams({ code: codeMatch[1] }),
    redirect: 'manual',
  });
  const session = readCookie(cookiesFrom(callback), '__session');
  if (!session) throw new Error(`OIDC session missing (HTTP ${callback.status})`);

  const dashboard = await fetch(`${MPG_WEB}/dashboard?_data=root`, {
    headers: { Cookie: [`__session=${session}`, initialCookies].filter(Boolean).join('; ') },
  });
  if (!dashboard.ok) throw new Error(`OIDC token exchange failed (HTTP ${dashboard.status})`);
  const result = await dashboard.json();
  if (!result?.token) throw new Error('MPG API token missing from authenticated dashboard');
  return result.token;
}

async function authenticateSimple(email, password) {
  const response = await fetch(`${API}/user/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: email, password, language: 'fr-FR' }),
  });
  if (!response.ok) throw new Error(`Direct sign-in failed (HTTP ${response.status})`);
  const result = await response.json();
  if (!result?.token) throw new Error('MPG API token missing from direct sign-in response');
  return result.token;
}

function valueShape(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return value.length ? { type: 'array', length: value.length, item: valueShape(value[0], depth + 1) } : { type: 'array', length: 0 };
  }
  if (typeof value !== 'object') return typeof value;
  const keys = Object.keys(value).sort();
  if (depth >= 4) return { type: 'object', keys };
  return Object.fromEntries(keys.map(key => {
    const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !key.startsWith('mpg_') ? key : '[dynamic-key]';
    return [safeKey, valueShape(value[key], depth + 1)];
  }));
}

function collectIds(value, pattern, found = new Set()) {
  if (typeof value === 'string' && pattern.test(value)) found.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectIds(item, pattern, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectIds(item, pattern, found));
  return found;
}

const email = process.env.MAIL_MPG;
const password = process.env.PASSWORD_MPG;
if (!email || !password) throw new Error('Missing MAIL_MPG or PASSWORD_MPG secret');

let token;
try {
  token = await authenticateOidc(email, password);
  console.log('Authentication: OIDC');
} catch (error) {
  // Older accounts can still use MPG's direct sign-in endpoint. Never print
  // response bodies or error objects: those can contain account information.
  console.log(`OIDC unavailable (${error.message}); trying direct sign-in`);
  token = await authenticateSimple(email, password);
  console.log('Authentication: direct sign-in');
}

const apiHeaders = { Authorization: token, 'Content-Type': 'application/json' };
async function inspect(label, path) {
  const response = await fetch(`${API}/${path}`, { headers: apiHeaders });
  if (!response.ok) {
    console.log(JSON.stringify({ endpoint: label, status: response.status }));
    return null;
  }
  const data = await response.json();
  console.log(JSON.stringify({ endpoint: label, status: response.status, shape: valueShape(data) }));
  return data;
}

const dashboard = await inspect('dashboard/leagues', 'dashboard/leagues');
if (!dashboard) throw new Error('Could not read MPG leagues');
const divisions = [...collectIds(dashboard, /^mpg_division_/)].slice(0, 30);
for (let index = 0; index < divisions.length; index++) {
  const divisionId = divisions[index];
  const label = `division-${index + 1}`;
  const division = await inspect(`${label}/division`, `division/${encodeURIComponent(divisionId)}`);
  await inspect(`${label}/coach`, `division/${encodeURIComponent(divisionId)}/coach`);
  await inspect(`${label}/available-players`, `division/${encodeURIComponent(divisionId)}/available-players`);
  const teams = [...collectIds(division, /^mpg_team_/)].slice(0, 12);
  for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
    await inspect(`${label}/team-${teamIndex + 1}`, `team/${encodeURIComponent(teams[teamIndex])}`);
  }
}

console.log(JSON.stringify({ summary: 'Read-only shape probe completed', leaguesFound: divisions.length }));
