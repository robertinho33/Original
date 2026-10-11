'use strict';
function isPublicFile(pathname) {
  if (/\\|\.\.|\.bak|(?:^|\/)[._]/i.test(pathname)) return false;
  return ['/', '/index.html', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/data/catalog/catalog-runtime.json', '/data/catalog/manifests/catalog-sources.json'].includes(pathname) ||
    /^\/(?:css\/[^/]+\.css|js\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.js|pages\/[a-z0-9_-]+\.html)$/i.test(pathname);
}
module.exports = { isPublicFile };
