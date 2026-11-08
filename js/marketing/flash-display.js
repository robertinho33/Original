const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const flashUrl = '/pages/promocao-relampago.html';

export function offerPricing(campaign, now = Date.now()) {
    const price = campaign?.offerPricing;
    const percent = Number(campaign?.discountPercent);
    if (campaign?.status !== 'active' || !campaign.offerId || !campaign.flashSku ||
        !(Date.parse(campaign.endsAt) > now) ||
        (campaign.startsAt && !(Date.parse(campaign.startsAt) <= now)) ||
        !price || ![price.originalCents, price.priceCents, price.savingsCents].every(Number.isSafeInteger) ||
        price.priceCents < 0 || price.savingsCents <= 0 ||
        price.originalCents - price.priceCents !== price.savingsCents ||
        !(percent > 0 && percent <= 100)) return null;
    return { ...price, percent };
}

export function priceMarkup(price) {
    return `<div class="flash-price"><small>⚡ ${price.percent.toLocaleString('pt-BR')}% de desconto</small><del>De ${money.format(price.originalCents / 100)}</del><strong>Por ${money.format(price.priceCents / 100)}</strong><small>Economize ${money.format(price.savingsCents / 100)}</small></div>`;
}
