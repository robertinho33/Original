// Checkout Pro can append its query inside an existing URL fragment.
export function readPaymentReturn(location) {
    const query = new URLSearchParams(location.search || '');
    const fragment = String(location.hash || '').replace(/^#/, '')
        .replace(/(^|&)token=([a-f0-9]{64})\?/i, '$1token=$2&');
    const hash = new URLSearchParams(fragment);
    return { query, hash, token: hash.get('token') || query.get('token') || '',
        paymentId: hash.get('payment_id') || query.get('payment_id') || '' };
}
