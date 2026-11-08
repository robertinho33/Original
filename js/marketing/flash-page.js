import { offerPricing, priceMarkup } from './flash-display.js';

const panel = document.querySelector('.flash-panel');
const status = document.getElementById('offer-status');

async function loadOffer() {
    try {
        const response = await fetch('/api/storefront/hero', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error();
        const { data } = await response.json();
        const price = offerPricing(data);
        if (!price) {
            status.textContent = 'Nenhuma promoção relâmpago disponível agora. Confira os produtos da loja.';
            return;
        }
        document.getElementById('offer-product').textContent = price.name;
        document.getElementById('offer-prices').innerHTML = priceMarkup(price);
        const image = panel.querySelector('img');
        if (price.image) {
            let url;
            try { url = new URL(price.image, location.origin); } catch {}
            if (url && (url.origin === location.origin || url.protocol === 'https:') && !url.username && !url.password) {
                image.src = url.href;
                image.alt = price.name;
                image.hidden = false;
                image.addEventListener('error', () => { image.hidden = true; }, { once: true });
            }
        }
        document.getElementById('offer-buy').href = '/index.html?' + new URLSearchParams({ search: data.flashSku }) + '#colecao';
        const end = Date.parse(data.endsAt);
        document.getElementById('offer-deadline').textContent = 'Até ' + new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
        }).format(end) + ' (horário de Brasília), enquanto houver estoque.';
        status.textContent = '';
        panel.hidden = false;
        const expire = () => {
            if (Date.now() < end) return;
            clearInterval(timer);
            panel.hidden = true;
            status.textContent = 'Esta promoção terminou. Confira os produtos da loja.';
        };
        const timer = setInterval(expire, 1000);
        window.addEventListener('pageshow', expire);
        expire();
    } catch {
        status.textContent = 'Não foi possível conferir a oferta agora. Atualize a página para tentar novamente.';
    }
}

void loadOffer();
