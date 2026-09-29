'use strict';

const QRCode = require('qrcode');

const {
    PIX_KEY,
    PIX_CITY,
    PIX_MERCHANT_NAME,
    normalizeTxid,
    createPixPayload
} = require('./pix-charge');

async function createPixCharge({ orderId, amount }) {
    const numericAmount = Number(amount);

    if (!orderId) {
        throw new Error('Pedido sem identificação.');
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Valor inválido para o PIX.');
    }

    const pixCode = createPixPayload({
        amount: numericAmount,
        orderId
    });

    const qrCode = await QRCode.toDataURL(
        pixCode,
        {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320
        }
    );

    return {
        success: true,
        provider: 'aurea-pix-core',
        status: 'pending',

        order_id: String(orderId),

        amount: Number(numericAmount.toFixed(2)),

        pix_key: PIX_KEY,
        pix_city: PIX_CITY,
        pix_merchant_name: PIX_MERCHANT_NAME,

        txid: normalizeTxid(orderId),

        pix_code: pixCode,
        qr_code: qrCode,

        created_at: new Date().toISOString()
    };
}

module.exports = {
    createPixCharge
};
