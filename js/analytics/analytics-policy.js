export const CONSENT_KEY = 'fp-analytics-consent-v1';
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;
const pageNames = {
    '/': 'Fios Perfeitos — Loja',
    '/index.html': 'Fios Perfeitos — Loja',
    '/pages/checkout.html': 'Fios Perfeitos — Checkout',
    '/pages/privacidade.html': 'Fios Perfeitos — Privacidade',
    '/pages/monte-seu-ritual.html': 'Fios Perfeitos — Cuidado do seu jeito',
    '/pages/trocas.html': 'Fios Perfeitos — Trocas e devoluções'
};
export function analyticsPage(href) {
    try {
        const url = new URL(href);
        if (url.protocol !== 'https:' || !['www.fiosperfeitos.com.br','fiosperfeitos.com.br'].includes(url.hostname) || (!pageNames[url.pathname] && !/^\/produto\/[^/]{1,160}$/.test(url.pathname) && url.pathname !== '/produtos')) return null;
        if ([...url.searchParams.keys()].some(key => /token|pedido|mp_test|mp_live_test|payment|collection|merchant_order|preference/i.test(key)) || /token=/i.test(url.hash)) return null;
        return {page_location: url.origin + url.pathname, page_title: pageNames[url.pathname] || 'Fios Perfeitos — Produtos', page_referrer: ''};
    } catch { return null; }
}
export function readConsent(raw, now = Date.now()) {
    try {
        const saved = JSON.parse(raw);
        return saved && ['granted','denied'].includes(saved.value) && Number.isFinite(saved.savedAt) && saved.savedAt <= now && now - saved.savedAt < CONSENT_TTL ? saved.value : null;
    } catch { return null; }
}
// No SDK is imported until consent is granted. Re-check after asynchronous loading.
export function createAnalyticsController({load, page, allowed = () => true}) {
    let consent = null;
    let sdk = null;
    let loading = null;
    let recorded = false;
    return {
        async choose(value) {
            try {
            consent = value;
            if (value !== 'granted') { sdk?.enable(false); return; }
            if (!page || !allowed()) return;
            loading ||= load().catch(() => { loading = null; return null; });
            const loaded = await loading;
            if (!loaded || consent !== 'granted' || !allowed()) return;
            sdk ||= loaded;
            sdk.enable(true);
            if (!recorded) { sdk.pageView(page); recorded = true; }
            } catch { /* Statistics must never interrupt a purchase. */ }
        }
    };
}
