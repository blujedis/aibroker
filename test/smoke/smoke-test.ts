/**
 * Smoke test script for AIBroker.
 * Requires a running dev server at http://localhost:5173.
 * Run with: pnpm run test:smoke
 *
 * Uses node:http directly so we control redirects and capture Set-Cookie
 * from intermediate redirect responses (Node.js global fetch swallows them).
 */

import http from 'node:http';
import https from 'node:https';

const BASE_URL = 'http://localhost:5173';
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'password';

// ---------------------------------------------------------------------------
// HTTP helpers (using node:http for full header/cookie visibility)
// ---------------------------------------------------------------------------

interface Resp {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  cookies: string[];
  body: string;
}

function rawRequest(
  method: string,
  urlStr: string,
  reqHeaders: Record<string, string> = {},
  body?: string
): Promise<Resp> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      path: url.pathname + url.search,
      method,
      headers: {
        ...reqHeaders,
        ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {})
      }
    };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const h = res.headers as Record<string, string | string[] | undefined>;
        const sc = h['set-cookie'] ?? [];
        resolve({
          status: res.statusCode ?? 0,
          headers: h,
          cookies: Array.isArray(sc) ? sc : [sc as string],
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(path: string, cookie?: string) {
  const h: Record<string, string> = {};
  if (cookie) h.Cookie = cookie;
  return rawRequest('GET', `${BASE_URL}${path}`, h);
}

function postForm(path: string, data: Record<string, string>, cookie?: string) {
  const body = new URLSearchParams(data).toString();
  const h: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cookie) h.Cookie = cookie;
  return rawRequest('POST', `${BASE_URL}${path}`, h, body);
}

function firstHeader(res: Resp, name: string): string {
  const v = res.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : (v ?? '');
}

function extractCookie(res: Resp, name: string): string | undefined {
  return res.cookies.find((c) => c.startsWith(`${name}=`));
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

async function testUnauthenticatedRoutes() {
  console.log('\n[1] Unauthenticated access');

  const loginPage = await get('/login');
  ok('GET /login returns 200', loginPage.status === 200, `got ${loginPage.status}`);

  const dashboard = await get('/dashboard');
  const isRedirect = dashboard.status >= 300 && dashboard.status < 400;
  ok('GET /dashboard redirects unauthenticated', isRedirect, `got ${dashboard.status}`);
  ok(
    'GET /dashboard redirects to /login',
    firstHeader(dashboard, 'location').includes('/login'),
    `location: ${firstHeader(dashboard, 'location')}`
  );

  const users = await get('/users');
  ok('GET /users redirects unauthenticated', users.status >= 300 && users.status < 400, `got ${users.status}`);
}

async function testInvalidLogin() {
  console.log('\n[2] Login – invalid credentials');

  const res = await postForm('/login', { email: 'nobody@example.com', password: 'wrong' });
  const loc = firstHeader(res, 'location');
  ok(
    'Invalid login does not redirect to /dashboard',
    !(res.status >= 300 && res.status < 400 && loc.includes('/dashboard')),
    `got ${res.status}, loc: ${loc}`
  );
}

async function testAdminLogin(): Promise<string | undefined> {
  console.log('\n[3] Login – bootstrap admin');

  const res = await postForm('/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const loc = firstHeader(res, 'location');
  const sessionCookie = extractCookie(res, 'np_session');

  ok(
    'Admin login completes (3xx redirect or 200 with session cookie)',
    (res.status >= 300 && res.status < 400) || (res.status === 200 && Boolean(sessionCookie)),
    `status: ${res.status}, location: ${loc}`
  );
  if (res.status >= 300 && res.status < 400) {
    ok(
      'Admin login redirect target is /dashboard or /mfa',
      loc.includes('/dashboard') || loc.includes('/mfa'),
      `location: ${loc}`
    );
  } else {
    ok('Admin login returned 200 with active session', Boolean(sessionCookie), `status: ${res.status}`);
  }

  ok('Session cookie is set', Boolean(sessionCookie));

  return sessionCookie;
}

async function testAuthenticatedRoutes(sessionCookie: string) {
  console.log('\n[4] Authenticated admin access');

  const dashboard = await get('/dashboard', sessionCookie);
  ok(
    'GET /dashboard reachable with valid session',
    dashboard.status === 200 || (dashboard.status >= 300 && dashboard.status < 400),
    `got ${dashboard.status}`
  );
  ok(
    'GET /dashboard does NOT redirect to /login',
    !firstHeader(dashboard, 'location').includes('/login'),
    `location: ${firstHeader(dashboard, 'location')}`
  );

  const users = await get('/users', sessionCookie);
  ok(
    'GET /users reachable for admin',
    users.status === 200 || (users.status >= 300 && users.status < 400),
    `got ${users.status}`
  );
  ok(
    'GET /users does NOT redirect to /login',
    !firstHeader(users, 'location').includes('/login'),
    `location: ${firstHeader(users, 'location')}`
  );

  const settings = await get('/settings', sessionCookie);
  ok(
    'GET /settings reachable for admin',
    settings.status === 200 || (settings.status >= 300 && settings.status < 400),
    `got ${settings.status}`
  );
  ok(
    'GET /settings does NOT redirect to /login',
    !firstHeader(settings, 'location').includes('/login'),
    `location: ${firstHeader(settings, 'location')}`
  );
}

async function testLogout(sessionCookie: string) {
  console.log('\n[5] Logout');

  const res = await postForm('/logout', {}, sessionCookie);
  ok('Logout returns 3xx', res.status >= 300 && res.status < 400, `got ${res.status}`);

  const dashboard = await get('/dashboard', sessionCookie);
  ok(
    'Logout invalidates session (dashboard → /login)',
    dashboard.status >= 300 && dashboard.status < 400 && firstHeader(dashboard, 'location').includes('/login'),
    `status ${dashboard.status}, loc: ${firstHeader(dashboard, 'location')}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`AIBroker Smoke Tests`);
  console.log(`Target : ${BASE_URL}`);
  console.log(`Admin  : ${ADMIN_EMAIL}`);

  try {
    await get('/login');
  } catch {
    console.error(`\nERROR: Cannot reach ${BASE_URL}. Is the dev server running?\n`);
    process.exit(1);
  }

  await testUnauthenticatedRoutes();
  await testInvalidLogin();
  const sessionCookie = await testAdminLogin();

  if (sessionCookie) {
    await testAuthenticatedRoutes(sessionCookie);
    await testLogout(sessionCookie);
  } else {
    console.error('\nSkipping authenticated tests – could not obtain session cookie.');
    failed += 2;
  }

  console.log(`\n${'─'.repeat(44)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
