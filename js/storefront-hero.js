const apiRoot = window.location.protocol === 'file:'
    ? 'http://localhost:3000'
    : '';

function safeCampaignUrl(value) {
    try { const url = new URL(value, location.origin); return url.protocol === 'https:' || (url.origin === location.origin && url.protocol === location.protocol) ? url.href : ''; } catch { return ''; }
}
function startOffer(campaign, reset) {
    const offer = document.getElementById('heroFlashOffer');
    const card = offer?.closest('.hero-card');
    const end = Date.parse(campaign.endsAt);
    const discount = Number(campaign.discountPercent);
    const pricing = campaign.offerPricing;
    const href = '/index.html?' + new URLSearchParams({ search: campaign.flashSku }) + '#colecao';
    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    if (!offer || !campaign.flashSku || !pricing || !Number.isFinite(end) || !(discount > 0 && discount <= 100) || end <= Date.now()) return;
    offer.href = href;
    document.getElementById('heroOfferProduct').textContent = pricing.name;
    document.getElementById('heroOfferOriginal').textContent = money.format(pricing.originalCents / 100);
    document.getElementById('heroOfferPrice').textContent = money.format(pricing.priceCents / 100);
    document.getElementById('heroOfferSavings').textContent = 'Economize ' + money.format(pricing.savingsCents / 100);
    document.getElementById('heroOfferLabel').textContent = campaign.offerLabel || 'OFERTA ESPECIAL';
    document.getElementById('heroOfferDiscount').textContent = `${discount.toLocaleString('pt-BR')}% OFF`;
    const tick = () => {
        const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (!remaining) { clearInterval(timer); reset(); return; }
        const days = Math.floor(remaining / 86400);
        const hours = String(Math.floor(remaining % 86400 / 3600)).padStart(2, '0');
        const minutes = String(Math.floor(remaining % 3600 / 60)).padStart(2, '0');
        const seconds = String(remaining % 60).padStart(2, '0');
        document.getElementById('heroOfferCountdown').textContent = `${days ? days + 'd ' : ''}${hours}:${minutes}:${seconds}`;
    };
    offer.hidden = false;
    card?.classList.add('has-flash-offer');
    const timer = setInterval(tick, 1000);
    tick();
}
async function loadCampaignHero() {
    try {
        const response = await fetch(`${apiRoot}/api/storefront/hero`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const result = await response.json();
        const campaign = result?.data;
        if (!result?.success || !campaign) return;

        const setText = (id, value) => {
            if (value !== undefined && value !== null) {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            }
        };
        if (campaign.endsAt && Date.parse(campaign.endsAt) <= Date.now()) return;
        if (campaign.startsAt && Date.parse(campaign.startsAt) > Date.now()) return;
        const defaults = ['heroCampaignEyebrow', 'heroCampaignTitle', 'heroCampaignEmphasis', 'heroCampaignEnding', 'heroCampaignDescription'].map(id => [id, document.getElementById(id)?.textContent]);
        const defaultButton = document.getElementById('heroCampaignButton');
        const defaultHref = defaultButton?.getAttribute('href');
        const defaultLabel = defaultButton?.firstChild.textContent;
        const reset = () => {
            defaults.forEach(([id, value]) => setText(id, value));
            document.getElementById('heroFlashOffer').hidden = true;
            document.getElementById('heroCampaignImage').hidden = true;
            document.querySelector('.hero-card')?.classList.remove('has-flash-offer', 'has-campaign-image');
            if (defaultButton) { defaultButton.href = defaultHref; defaultButton.firstChild.textContent = defaultLabel; }
        };
        // Preserve the new store headline when the published campaign still has the previous wording.
        if ([campaign.title, campaign.emphasis, campaign.ending].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() === 'Beleza que começa no ritual.') {
            campaign.title = 'Beleza que começa'; campaign.emphasis = 'com seus cuidados.'; campaign.ending = '';
        }
        startOffer(campaign, reset);
        setText('heroCampaignEyebrow', campaign.eyebrow);
        setText('heroCampaignTitle', campaign.title);
        setText('heroCampaignEmphasis', campaign.emphasis);
        setText('heroCampaignEnding', campaign.ending);
        setText('heroCampaignDescription', campaign.description);

        const button = document.getElementById('heroCampaignButton');
        if (button) {
            if (campaign.buttonLabel) button.firstChild.textContent = campaign.buttonLabel;
            const buttonUrl = safeCampaignUrl(campaign.buttonUrl);
            if (campaign.buttonUrl && buttonUrl) button.href = buttonUrl;
        }

        const image = document.getElementById('heroCampaignImage');
        const card = image?.closest('.hero-card');
        const imageUrl = safeCampaignUrl(campaign.imageUrl);
        if (image && campaign.imageUrl && imageUrl) {
            image.src = imageUrl;
            image.alt = campaign.imageAlt || campaign.title || 'Banner da campanha Fios Perfeitos';
            image.hidden = false;
            card?.classList.add('has-campaign-image');
        }
    } catch (error) {
        console.info('[STOREFRONT] Mantendo o banner padrão:', error?.message || error);
    }
}

loadCampaignHero();
