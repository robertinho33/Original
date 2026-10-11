const test = require('node:test');
const assert = require('node:assert/strict');
const { isPublicFile } = require('./public-files');
test('permite páginas, módulos e catálogo público usados pela loja', () => {
  for (const path of ['/', '/index.html', '/js/catalog/catalog-service.js', '/pages/checkout.html', '/css/style.css', '/data/catalog/catalog-runtime.json']) assert.equal(isPublicFile(path), true, path);
});
test('bloqueia arquivos operacionais, exportações, staging e cópias', () => {
  for (const path of ['/server.js', '/.env', '/RUNBOOK.md', '/render.yaml', '/data/produtos.csv', '/data/catalog/_staging/catalog-normalized.json', '/js/admin/admin.js.bak', '/js/../server.js']) assert.equal(isPublicFile(path), false, path);
});
