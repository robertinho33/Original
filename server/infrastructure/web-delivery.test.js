'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { deliveryHeaders, staticHeaders, registerSearchFiles, INDEXABLE } = require('./web-delivery');
const { createPublishedJsonReader } = require('./published-json');
test('indexable documents have matching canonical URLs and no product claims without product pages', () => {
  const {readFileSync}=require('node:fs'); const {resolve}=require('node:path');
  for(const path of INDEXABLE) {
    const html=readFileSync(resolve(__dirname,'../..',path==='/'?'pages/boas-vindas.html':path.slice(1)),'utf8');
    assert.ok(html.includes(`rel="canonical" href="https://www.fiosperfeitos.com.br${path}"`),path);
  }
  const html=readFileSync(resolve(__dirname,'../../index.html'),'utf8');
  const schema=JSON.parse(/type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(schema['@graph'].find(item=>item['@type']==='WebPage').url,'https://www.fiosperfeitos.com.br/index.html');
});
test('private API defaults cannot be retained in browser or proxy caches', async t => {
  const app = express(); app.use(deliveryHeaders); registerSearchFiles(app);
  app.get('/api/orders/example', (req,res) => res.json({success:true}));
  app.get('/pages/checkout.html', (req,res) => { staticHeaders(res, 'checkout.html'); res.send('checkout'); });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/api/orders/example','/pages/checkout.html']) {
    const response = await fetch(base+path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  const robots = await (await fetch(base+'/robots.txt')).text();
  assert.match(robots,/Sitemap: https:\/\/www.fiosperfeitos.com.br\/sitemap.xml/);
  const sitemap = await (await fetch(base+'/sitemap.xml')).text();
  assert.equal((sitemap.match(/<loc>/g)||[]).length, INDEXABLE.length);
  assert.doesNotMatch(sitemap,/checkout|admin|token|influenciadores/);
});
test('unversioned scripts revalidate while images get bounded cache', () => {
  const headers = {}; const res = {setHeader:(k,v)=>headers[k]=v,getHeader:k=>headers[k]};
  staticHeaders(res,'app.js'); assert.match(headers['Cache-Control'],/must-revalidate/);
  staticHeaders(res,'brae.png'); assert.equal(headers['Cache-Control'],'public, max-age=3600');
  headers['Cache-Control']='no-store'; staticHeaders(res,'admin.html'); assert.equal(headers['Cache-Control'],'no-store');
});
test('published JSON deduplicates concurrent reads and retries failed reads', async () => {
  let calls=0;
  const load=createPublishedJsonReader('test.json',async()=>{calls++; if(calls===1)throw Error('temporary');return '\uFEFF{"products":[]}';});
  await assert.rejects(load(),/temporary/);
  const [first,second]=await Promise.all([load(),load()]);
  assert.equal(calls,2); assert.equal(first,second); assert.deepEqual(first,{products:[]});
  await load(); assert.equal(calls,2);
});
