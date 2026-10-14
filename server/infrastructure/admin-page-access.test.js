const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerAdminPageAccess, isAdminPage } = require('./admin-page-access');

test('admin page routes exclude only the public login', () => {
  for (const path of ['/pages/admin.html', '/pages/admin-orders.html', '/admin', '/admin/users']) {
    assert.equal(isAdminPage(path), true);
  }
  for (const path of ['/pages/admin-login.html', '/pages/manutencao.html', '/index.html', '/api/admin/orders']) {
    assert.equal(isAdminPage(path), false);
  }
});
test('server denies missing, forged, revoked and unauthorized sessions before serving the panel', async () => {
  const app = express();
  const identities = { valid: { email: 'robertinho33@gmail.com' }, visitor: { email: 'visitor@example.com' } };
  registerAdminPageAccess(app, { express, getAuth: () => ({
    verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); if (!identities[token]) throw Error(); return identities[token]; },
    createSessionCookie: async () => 'valid',
    verifySessionCookie: async (token, revoked) => { assert.equal(revoked, true); if (!identities[token]) throw Error(); return identities[token]; }
  }) });
  app.use((req, res) => res.send('page'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const cookie of ['', '__Host-nefer_admin=forged', '__Host-nefer_admin=visitor']) {
      const response = await fetch(`${url}/pages/admin.html`, { redirect: 'manual', headers: { cookie } });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/index.html');
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch(`${url}/pages/admin-login.html`)).status, 200);
    assert.equal((await fetch(`${url}/pages/admin.html`, { headers: { cookie: '__Host-nefer_admin=valid' } })).status, 200);
    for (const [origin, token, status] of [['https://attacker.example', 'valid', 403], ['https://www.fiosperfeitos.com.br', 'visitor', 403], ['https://www.fiosperfeitos.com.br', 'forged', 401]]) {
      assert.equal((await fetch(`${url}/api/admin-session`, { method: 'POST', headers: { origin, authorization: `Bearer ${token}` } })).status, status);
    }
    const session = await fetch(`${url}/api/admin-session`, { method: 'POST', headers: { origin: 'https://www.fiosperfeitos.com.br', authorization: 'Bearer valid' } });
    assert.equal(session.status, 200);
    assert.match(session.headers.get('set-cookie'), /HttpOnly/);
    assert.match(session.headers.get('set-cookie'), /Secure/);
    assert.match(session.headers.get('set-cookie'), /SameSite=Strict/);
    const logout = await fetch(`${url}/api/admin-session/logout`, { method: 'POST' });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
