export function privateTrackingUrl(order, origin) {
    const token = order?.publicTrackingToken || order?.trackingToken;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return '';
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol)) return '';
    return base.origin + '/pages/rastrear-pedido.html#token=' + token;
}
