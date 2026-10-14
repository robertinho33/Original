import { loadProducts } from './catalog/catalog-service.js';
async function populateHero() {
    const stage = document.getElementById('heroProductStage');
    if (!stage) return;
    try {
        const products = await loadProducts();
        const picks = products.filter(product => product.image && product.active !== false && Number(product.stock) > 0).slice(0, 3);
        let loaded = 0;
        for (const product of picks) {
            const url = new URL(product.image, location.origin);
            if (url.protocol !== 'https:' && url.origin !== location.origin) continue;
            const image = document.createElement('img');
            image.alt = product.name;
            image.decoding = 'async';
            image.addEventListener('load', () => { loaded += 1; stage.classList.add('has-products'); });
            image.addEventListener('error', () => { image.remove(); if (!loaded) stage.classList.remove('has-products'); });
            image.src = url.href;
            stage.append(image);
        }
    } catch { /* Keep the editorial fallback when the catalog is unavailable. */ }
}
populateHero();
