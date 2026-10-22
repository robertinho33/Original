'use strict';
const ORIGIN = 'https://www.fiosperfeitos.com.br';
const INDEXABLE = ['/', '/index.html', '/pages/monte-seu-ritual.html', '/pages/trocas.html', '/pages/privacidade.html'];
function deliveryHeaders(req, res, next) {
  // Public catalog controllers may explicitly override this after authorization-free reads.
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  } else if (/\.html$/i.test(req.path) && !INDEXABLE.includes(req.path) && req.path !== '/pages/boas-vindas.html') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
function staticHeaders(res, filename) {
  if (String(res.getHeader('Cache-Control') || '').includes('no-store')) return;
  // Assets have no content hashes: revalidate code instead of retaining obsolete checkout code.
  res.setHeader('Cache-Control', /\.(?:png|jpe?g|webp|ico|svg)$/i.test(filename)
    ? 'public, max-age=3600' : 'public, max-age=0, must-revalidate');
}
function registerSearchFiles(app, {getProducts} = {}) {
  app.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=3600')
    .send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  app.get('/sitemap.xml', async (req, res, next) => {
    try {
      const products = getProducts ? await getProducts() : [];
      const urls = [...INDEXABLE, ...(getProducts ? ['/produtos'] : []), ...products.map(product => '/produto/'+encodeURIComponent(String(product.sku)))];
      const xml = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
      res.type('application/xml').set('Cache-Control','public, max-age=0, must-revalidate').send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
        urls.map(url=>`<url><loc>${xml(ORIGIN+url)}</loc></url>`).join('')+'</urlset>');
    } catch(error){next(error);}
  });
}
module.exports = { ORIGIN, INDEXABLE, deliveryHeaders, staticHeaders, registerSearchFiles };
