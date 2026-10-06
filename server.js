require("dotenv").config();
const { randomBytes } = require('node:crypto');
const couponRoutes = require('./server/modules/coupons/coupon-routes');
const aureaAdminRoutes = require("./server/modules/admin/admin-routes");
const orderRoutes = require('./server/modules/orders/order-routes');
const { applyHttpFoundation } = require('./server/core/http');
const { errorHandler } = require('./server/infrastructure/error-handler');
const { registerGracefulShutdown } = require('./server/infrastructure/shutdown');
const { logger } = require('./server/infrastructure/logger');
const express = require('express');
const { createPixCharge } = require('./server/modules/payments/pix/pix-service');
const { validateCoupon } = require('./server/modules/coupons/coupon-service');

const { adminRoutes } = require('./server/modules/admin');
const { inventoryRoutes } = require('./server/modules/inventory');
const monitoringRoutes = require('./server/infrastructure/monitoring/monitoring-routes');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();

const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

applyHttpFoundation(app);
const PORT = process.env.PORT || 3000;

/*
=========================================================
 CONFIGURAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O PIX
=========================================================
*/

const PIX_KEY = '+5511986215473';
const PIX_CITY = 'SAO PAULO';
const PIX_MERCHANT_NAME = 'NEFER COSMETICS';

/*
=========================================================
 MIDDLEWARE
=========================================================
*/


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors({
    origin: [
        'https://www.fiosperfeitos.com.br',
        'https://fiosperfeitos.com.br',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],
    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ],
    credentials: true,
    optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/admin', aureaAdminRoutes);
app.get('/api/storefront/hero', require('./server/modules/admin/controllers/marketing-controller').publicHero);
app.get('/api/storefront/catalog-visibility', require('./server/modules/catalog/catalog-visibility-controller').storefront);
app.get('/api/storefront/tracking/:reference', require('./server/modules/orders/public-tracking-controller').getPublicTracking);
app.use('/api/coupons', couponRoutes);
app.use('/api/orders', orderRoutes);

// =========================================================
// FIM DO MIDDLEWARE
// =========================================================

/*
=========================================================
 UTILITÃƒÆ’Ã‚ÂRIOS PIX
=========================================================
*/

function normalizeText(value, maxLength) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 .-]/g, '')
        .trim()
        .substring(0, maxLength);
}


function formatField(id, value) {
    const text = String(value);

    return (
        id +
        String(text.length).padStart(2, '0') +
        text
    );
}


/*
=========================================================
 CRC16-CCITT
=========================================================
*/

function crc16(payload) {
    let crc = 0xFFFF;

    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;

        for (let bit = 0; bit < 8; bit++) {
            if (crc & 0x8000) {
                crc =
                    ((crc << 1) ^ 0x1021) &
                    0xFFFF;
            } else {
                crc =
                    (crc << 1) &
                    0xFFFF;
            }
        }
    }

    return crc
        .toString(16)
        .toUpperCase()
        .padStart(4, '0');
}


/*
=========================================================
 NORMALIZAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO TXID
=========================================================
*/

function normalizeTxid(orderId) {
    const normalized = String(orderId || '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .substring(0, 25);

    return normalized || '***';
}


/*
=========================================================
 GERADOR DO PAYLOAD PIX
=========================================================
*/

function createPixPayload({ amount, orderId }) {

    const numericAmount = Number(amount);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {
        throw new Error(
            'Valor invÃƒÆ’Ã‚Â¡lido para o PIX.'
        );
    }

    const merchantName =
        normalizeText(
            PIX_MERCHANT_NAME,
            25
        ) || 'NEFER COSMETICS';

    const city =
        normalizeText(
            PIX_CITY,
            15
        ) || 'SAO PAULO';

    const txid =
        normalizeTxid(orderId);

    /*
    -----------------------------------------------------
     Merchant Account Information
    -----------------------------------------------------
    */

    const merchantAccountInformation =
        formatField(
            '00',
            'BR.GOV.BCB.PIX'
        ) +
        formatField(
            '01',
            PIX_KEY
        );

    /*
    -----------------------------------------------------
     Additional Data Field Template
    -----------------------------------------------------
    */

    const additionalData =
        formatField(
            '05',
            txid
        );

    /*
    -----------------------------------------------------
     PAYLOAD SEM CRC
    -----------------------------------------------------
    */

    let payload =
        formatField(
            '00',
            '01'
        ) +

        formatField(
            '26',
            merchantAccountInformation
        ) +

        formatField(
            '52',
            '0000'
        ) +

        formatField(
            '53',
            '986'
        ) +

        formatField(
            '54',
            numericAmount.toFixed(2)
        ) +

        formatField(
            '58',
            'BR'
        ) +

        formatField(
            '59',
            merchantName
        ) +

        formatField(
            '60',
            city
        ) +

        formatField(
            '62',
            additionalData
        ) +

        '6304';

    /*
    -----------------------------------------------------
     CRC16
    -----------------------------------------------------
    */

    const checksum = crc16(payload);

    payload += checksum;

    return payload;
}


/*
=========================================================
 API ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â CRIAR PIX
=========================================================
*/

app.post(
    '/api/create-pix-payment',
    async (req, res) => {
        try {
            const order = req.body || {};

            const orderId = String(
                order.id || ''
            ).trim();

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'Pedido sem identificação.'
                });
            }

            const requestedItems =
                Array.isArray(order.items)
                    ? order.items
                    : [];

            if (!requestedItems.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Pedido sem produtos.'
                });
            }

            const deliveryMethod =
                String(
                    order.delivery?.method ||
                    order.deliveryMethod ||
                    'delivery'
                ).trim().toLowerCase();

            const requestedShipping =
                Number(
                    order.delivery?.cost ??
                    order.shipping ??
                    19.90
                );

            const shipping =
                deliveryMethod === 'pickup'
                    ? 0
                    : Number.isFinite(requestedShipping) &&
                      requestedShipping >= 0
                        ? requestedShipping
                        : 19.90;

            if (!Number.isFinite(shipping) || shipping < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Frete do pedido inválido.'
                });
            }

            const { prepareOrder } = require('./server/modules/orders/order-authority');

            const baseOrder = await prepareOrder({
                items: requestedItems,
                shipping,
                discount: 0,
                customer: order.customer || {},
                paymentMethod:
                    order.payment?.method || 'pix'
            });

            const subtotal =
                Number(baseOrder.totals.subtotal);

            let discount = 0;
            let coupon = null;

            const couponCode =
                String(
                    order.coupon?.code || ''
                ).trim();

            if (couponCode) {
                const couponResult =
                    await validateCoupon(couponCode);

                if (!couponResult.valid) {
                    return res.status(400).json({
                        success: false,
                        message:
                            couponResult.message ||
                            'Cupom inválido ou expirado.'
                    });
                }

                coupon = couponResult.coupon;

                const couponValue =
                    Number(coupon.discount);

                if (
                    !Number.isFinite(couponValue) ||
                    couponValue < 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Cupom com configuração inválida.'
                    });
                }

                if (
                    coupon.discountType ===
                    'percentage'
                ) {
                    discount =
                        subtotal *
                        couponValue /
                        100;
                } else {
                    discount =
                        Math.min(
                            subtotal,
                            couponValue
                        );
                }

                discount = Number(
                    Math.max(
                        0,
                        discount
                    ).toFixed(2)
                );
            }

            const authoritativeOrder =
                await prepareOrder({
                    items: requestedItems,
                    shipping,
                    discount,
                    customer: order.customer || {},
                    paymentMethod:
                        order.payment?.method || 'pix',
                    coupon
                });

            const orderRepository =
                require('./server/modules/orders/order-repository');
            const publicTrackingToken =
                randomBytes(32).toString('hex');
            const amount =
                Number(
                    authoritativeOrder.totals.total
                );

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Total autorizado do pedido inválido.'
                });
            }

            const payment =
                await createPixCharge({
                    orderId:
                        authoritativeOrder.orderNumber,
                    amount
                });

            const pixGeneratedAt = new Date().toISOString();
            const persistedOrder =
                await orderRepository.create(
                    {
                        ...authoritativeOrder,
                        publicTrackingToken,
                        coupon: coupon
                            ? { ...coupon }
                            : null,
                        payment: {
                            ...authoritativeOrder.payment,
                            status: payment.status || 'pending',
                            provider: payment.provider || 'aurea-pix-core',
                            orderId: payment.order_id || authoritativeOrder.orderNumber,
                            txid: payment.txid || '',
                            pixKey: payment.pix_key || '',
                            pixCity: payment.pix_city || '',
                            merchantName: payment.pix_merchant_name || '',
                            pixCode: payment.pix_code || '',
                            pixGeneratedAt
                        }
                    }
                );

            console.log(
                '[NEFER ORDER] pedido salvo no Firestore:',
                persistedOrder.id,
                '|',
                persistedOrder.orderNumber
            );

            console.log(
                '[NEFER PIX] cobrança criada:',
                orderId,
                '| R$',
                amount.toFixed(2),
                '| cupom:',
                coupon
                    ? coupon.code
                    : 'nenhum',
                '|',
                payment.txid
            );

            return res.json({
                ...payment,
                order: {
                    orderNumber:
                        persistedOrder.orderNumber,
                    publicTrackingToken:
                        persistedOrder.publicTrackingToken,
                    subtotal:
                        persistedOrder.totals.subtotal,
                    discount:
                        persistedOrder.totals.discount,
                    shipping:
                        persistedOrder.totals.shipping,
                    total:
                        persistedOrder.totals.total,
                    coupon: coupon
                        ? {
                            id: coupon.id,
                            code: coupon.code,
                            discount:
                                coupon.discount,
                            discountType:
                                coupon.discountType,
                            affiliateName:
                                coupon.affiliateName,
                            influencerId:
                                coupon.influencerId || '',
                            commission:
                                coupon.commission
                        }
                        : null
                }
            });

        } catch (error) {
            console.error(
                '[NEFER PIX] erro:',
                error
            );

            const status = Number(error?.status) || 500;
            const safeMessage = status >= 500
                ? 'Não foi possível preparar o PIX. Tente novamente.'
                : error?.message || 'Não foi possível validar o pedido.';

            return res.status(
                status
            ).json({
                success: false,
                code: error?.code || 'PIX_CREATION_FAILED',
                message: safeMessage
            });
        }
    }
);
/*
=========================================================
 SERVIDOR
=========================================================
*/


app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log('');
        console.log(
            '========================================'
        );
        console.log(
  ' NEFER COSMETICS — SERVIDOR'
        );
        console.log(
            '========================================'
        );
        console.log(
            ` Site: http://localhost:${PORT}/`
        );
        console.log(
            ` Checkout: http://localhost:${PORT}/pages/checkout.html`
        );
        console.log(
            ` API PIX: http://localhost:${PORT}/api/create-pix-payment`
        );
        console.log(
            ` Chave PIX: ${PIX_KEY}`
        );
        console.log(
            ` Cidade: ${PIX_CITY}`
        );
        console.log(
            '========================================'
        );
        console.log('');
    }
);
