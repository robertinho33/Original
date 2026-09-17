const orderRoutes = require('./server/modules/orders/order-routes');
const { applyHttpFoundation } = require('./server/core/http');
const { errorHandler } = require('./server/infrastructure/error-handler');
const { registerGracefulShutdown } = require('./server/infrastructure/shutdown');
const { logger } = require('./server/infrastructure/logger');
const express = require('express');
const { adminRoutes } = require('./server/modules/admin');
const { inventoryRoutes } = require('./server/modules/inventory');
const monitoringRoutes = require('./server/infrastructure/monitoring/monitoring-routes');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();

applyHttpFoundation(app);
const PORT = process.env.PORT || 3000;

/*
=========================================================
 CONFIGURAÃ‡ÃƒO PIX
=========================================================
*/

const PIX_KEY = '+5511986215473';
const PIX_CITY = 'SAO PAULO';
const PIX_MERCHANT_NAME = 'AUREA COSMETICS';

/*
=========================================================
 MIDDLEWARE
=========================================================
*/

app.use(cors());
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/monitoring', monitoringRoutes);

/*
=========================================================
 UTILITÃRIOS PIX
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
 NORMALIZAÃ‡ÃƒO DO TXID
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
            'Valor invÃ¡lido para o PIX.'
        );
    }

    const merchantName =
        normalizeText(
            PIX_MERCHANT_NAME,
            25
        ) || 'AUREA COSMETICS';

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
 API â€” CRIAR PIX
=========================================================
*/

app.post(
    '/api/create-pix-payment',
    async (req, res) => {

        try {

            const order = req.body || {};

            const amount = Number(
                order.total
            );

            const orderId =
                String(
                    order.id || ''
                ).trim();

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Valor do pedido invÃ¡lido.'
                });
            }

            const pixCode =
                createPixPayload({
                    amount,
                    orderId
                });

            /*
            -------------------------------------------------
             QR CODE
            -------------------------------------------------
            */

            const qrCodeDataUrl =
                await QRCode.toDataURL(
                    pixCode,
                    {
                        errorCorrectionLevel: 'M',
                        margin: 2,
                        width: 320
                    }
                );

            console.log('');
            console.log(
                '========================================'
            );
            console.log(
                ' PIX GERADO'
            );
            console.log(
                '========================================'
            );
            console.log(
                `Valor: R$ ${amount.toFixed(2)}`
            );
            console.log(
                `Pedido: ${orderId || '(sem ID)'}`
            );
            console.log(
                `Chave: ${PIX_KEY}`
            );
            console.log(
                `TXID: ${normalizeTxid(orderId)}`
            );
            console.log('');
            console.log(
                'PIX COPIA E COLA:'
            );
            console.log(
                pixCode
            );
            console.log('');
            console.log(
                'CRC16:',
                pixCode.slice(-4)
            );
            console.log(
                '========================================'
            );
            console.log('');

            return res.json({
                success: true,

                amount: Number(
                    amount.toFixed(2)
                ),

                pix_key: PIX_KEY,

                pix_city: PIX_CITY,

                pix_merchant_name:
                    PIX_MERCHANT_NAME,

                pix_code: pixCode,

                qr_code: qrCodeDataUrl
            });

        } catch (error) {

            console.error(
                '[PIX] Erro ao gerar PIX:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error?.message ||
                    'Erro ao gerar PIX.'
            });
        }
    }
);


/*
=========================================================
 ARQUIVOS ESTÃTICOS
=========================================================
*/

app.use(
    express.static(__dirname)
);


/*
=========================================================
 SERVIDOR
=========================================================
*/

app.listen(
    PORT,
    () => {

        console.log('');
        console.log(
            '========================================'
        );
        console.log(
            ' AUREA COSMETICS â€” SERVIDOR'
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





