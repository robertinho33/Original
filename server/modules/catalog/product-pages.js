'use strict';
const { createHash } = require('node:crypto');
const { ORIGIN } = require('../../infrastructure/web-delivery');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const productPath = product => '/produto/' + encodeURIComponent(String(product.sku));
const safeImage = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
function selectIndexable(products, visibility) {
  const sources = new Set(visibility.sources.filter(source => source.visible === true).map(source => String(source.id).toLowerCase()));
  const hidden = new Set(visibility.inactiveProductSkus.map(sku => String(sku).toLowerCase()));
  return products.filter(product => product.sku && product.name && product.active !== false &&
    !/^INATIVO\b/i.test(product.name) && Number.isFinite(Number(product.price)) && Number(product.price) > 0 &&
    sources.has(String(product.sourceId).toLowerCase()) && !hidden.has(String(product.sku).toLowerCase()));
}
async function getIndexableProducts() {
  const [products, visibility] = await Promise.all([
    require('./catalog-storefront-service').getPublicCatalog(),
    require('./catalog-visibility-service').getVisibility()
  ]);
  return selectIndexable(products, visibility);
}
function schemaFor(product) {
  const image = safeImage(product.image);
  return {'@context':'https://schema.org','@type':'Product',name:String(product.name),sku:String(product.sku),
    description:String(product.description || product.name),...(image ? {image:[image]} : {}),
    ...(product.sourceName ? {brand:{'@type':'Brand',name:String(product.sourceName)}} : {}),
    offers:{'@type':'Offer',url:ORIGIN+productPath(product),priceCurrency:'BRL',price:Number(product.price).toFixed(2),
      availability:'https://schema.org/'+(Number(product.stock)>0?'InStock':'OutOfStock'),itemCondition:'https://schema.org/NewCondition'}};
}
function layout({title, description, canonical, body, schema}) {
  const json = schema ? JSON.stringify(schema).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029') : '';
  const image = schema?.image?.[0];
  return {json,html:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Fios Perfeitos</title><meta name="description" content="${escape(description.slice(0,170))}"><link rel="canonical" href="${escape(ORIGIN+canonical)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="${schema?'product':'website'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description.slice(0,170))}"><meta property="og:url" content="${escape(ORIGIN+canonical)}">${image?`<meta property="og:image" content="${escape(image)}">`:''}<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/portal.css"><link rel="stylesheet" href="/css/product-page.css">${json?`<script type="application/ld+json">${json}</script>`:''}</head><body><header class="portal-top"><a class="portal-brand" href="/">fp <span>Fios Perfeitos</span></a><a class="quiet-link" href="/index.html">Voltar à loja ↗</a></header><main class="product-page">${body}</main><footer class="portal-footer"><a href="/pages/trocas.html">Entrega e devoluções</a><a href="/pages/privacidade.html">Privacidade</a><a href="https://wa.me/5511986215473" rel="noopener noreferrer">Atendimento</a></footer>${schema?'<script type="module" src="/js/product-page.js"></script>':''}</body></html>`};
}
function renderProduct(product) {
  const image = safeImage(product.image), available = Number(product.stock)>0;
  const price = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(product.price));
  return layout({title:product.name,description:String(product.description||product.name),canonical:productPath(product),schema:schemaFor(product),body:
    `<nav class="product-breadcrumb" aria-label="Navegação"><a href="/index.html">Loja</a> / <a href="/produtos">Produtos</a></nav><article class="product-detail"><div class="product-detail-image">${image?`<img src="${escape(image)}" alt="${escape(product.name)}" width="600" height="600" fetchpriority="high" decoding="async">`:'<p>Imagem indisponível</p>'}</div><div><p class="eyebrow">${escape(product.sourceName||'Fios Perfeitos')}</p><h1>${escape(product.name)}</h1><p class="product-sku">SKU: ${escape(product.sku)}</p><p class="product-detail-price">${escape(price)}</p><p>${available?'Disponível para compra':'Produto indisponível no momento'}</p><p>Frete e prazo calculados pelo CEP no checkout.</p><form id="productBuyForm" data-sku="${escape(product.sku)}" data-stock="${Math.max(0,Math.floor(Number(product.stock)||0))}"><label for="productQuantity">Quantidade</label><input id="productQuantity" type="number" min="1" max="${Math.max(1,Math.floor(Number(product.stock)||0))}" value="1" required><button class="solid-button" type="submit" ${available?'':'disabled'}>Adicionar à sacola e continuar ↗</button></form><p id="productBuyMessage" role="status" aria-live="polite"></p><noscript><p>Ative o JavaScript para adicionar à sacola, ou fale com o atendimento.</p></noscript><h2>Sobre o produto</h2><p class="product-description">${escape(product.description||'Consulte o atendimento para mais informações sobre este produto.')}</p><p>Preço e disponibilidade são conferidos novamente antes do pagamento.</p></div></article>`});
}
function setSchemaPolicy(res,json) {
  if (!json) return;
  const hash = "'sha256-"+createHash('sha256').update(json).digest('base64')+"'";
  const existing = String(res.getHeader('Content-Security-Policy')||"default-src 'self'; script-src 'self'");
  res.setHeader('Content-Security-Policy',existing.replace(/script-src\s+[^;]+/,directive=>directive+' '+hash));
}
function registerProductPages(app, {getProducts=getIndexableProducts}={}) {
  app.get('/produto/:sku', async (req,res,next) => {
    try {
      const product=(await getProducts()).find(row=>String(row.sku)===req.params.sku);
      if(!product) return res.set('X-Robots-Tag','noindex').status(404).type('html').send('<h1>Produto não encontrado</h1><a href="/index.html">Voltar à loja</a>');
      const page=renderProduct(product); setSchemaPolicy(res,page.json);
      return res.set('Cache-Control','public, max-age=0, must-revalidate').type('html').send(page.html);
    } catch(error){next(error);}
  });
  app.get('/produtos', async (req,res,next) => {
    try {
      const products=await getProducts(),pages=Math.max(1,Math.ceil(products.length/36));
      const value=String(req.query.pagina||'1');
      if(!/^[1-9]\d{0,4}$/.test(value)||Number(value)>pages)return res.set('X-Robots-Tag','noindex').sendStatus(404);
      const page=Number(value),canonical='/produtos'+(page>1?'?pagina='+page:'');
      const links=products.slice((page-1)*36,page*36).map(product=>`<li><a href="${escape(productPath(product))}">${escape(product.name)}</a></li>`).join('');
      const body=`<h1>Produtos para seus cabelos</h1><p>Conheça o catálogo Fios Perfeitos.</p><ul class="product-directory">${links}</ul><nav class="product-pagination" aria-label="Páginas do catálogo">${page>1?`<a href="/produtos${page>2?'?pagina='+(page-1):''}">← Anterior</a>`:''}<span>Página ${page} de ${pages}</span>${page<pages?`<a href="/produtos?pagina=${page+1}">Próxima →</a>`:''}</nav>`;
      return res.set('Cache-Control','public, max-age=0, must-revalidate').type('html').send(layout({title:'Produtos — página '+page,description:'Explore produtos, preços e marcas para cuidar dos seus cabelos.',canonical,body}).html);
    }catch(error){next(error);}
  });
}
module.exports={productPath,selectIndexable,getIndexableProducts,schemaFor,renderProduct,registerProductPages};
