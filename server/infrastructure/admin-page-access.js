'use strict';

const COOKIE = '__Host-nefer_admin';
const EXPIRES = 60 * 60 * 1000;
function authorized(identity) {
  const email = String(identity?.email || '').trim().toLowerCase();
  return Boolean(email && (email === 'robertinho33@gmail.com' || identity.admin === true ||
    ['admin', 'collaborator'].includes(String(identity.role || '').toLowerCase())));
}
function isAdminPage(pathname) {
  return /^\/(?:pages\/)?admin(?:[./_-]|$)/i.test(pathname) &&
    pathname.toLowerCase() !== '/pages/admin-login.html';
}
function registerAdminPageAccess(app, { getAuth, express }) {
  const options = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };
  app.post('/api/admin-session', express.json({ limit: '8kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!origin || !['https://www.fiosperfeitos.com.br', 'https://fiosperfeitos.com.br'].includes(origin)) {
      return res.sendStatus(403);
    }
    const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
    try {
      if (!token) return res.sendStatus(401);
      const auth = getAuth();
      const identity = await auth.verifyIdToken(token, true);
      if (!authorized(identity)) return res.sendStatus(403);
      const cookie = await auth.createSessionCookie(token, { expiresIn: EXPIRES });
      res.cookie(COOKIE, cookie, { ...options, maxAge: EXPIRES });
      return res.json({ success: true });
    } catch { return res.sendStatus(401); }
  });
  app.post('/api/admin-session/logout', (req, res) => {
    res.clearCookie(COOKIE, options);
    res.set('Cache-Control', 'no-store').sendStatus(204);
  });
  app.use(async (req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    if (!isAdminPage(pathname)) return next();
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const value = String(req.get('cookie') || '').split(';').map(part => part.trim())
      .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    try {
      if (!value || !authorized(await getAuth().verifySessionCookie(value, true))) {
        return res.redirect(302, '/index.html');
      }
      return next();
    } catch { return res.redirect(302, '/index.html'); }
  });
}
module.exports = { registerAdminPageAccess, isAdminPage, authorized };
