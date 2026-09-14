const PIX_KEY = '11986215473';
const PIX_CITY = 'SAO PAULO';
const PIX_MERCHANT_NAME = 'AUREA COSMETICS';

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

function crc16(payload) {
let crc = 0xFFFF;

```
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
```

}

export function createPixPayload({
amount,
orderId
}) {
const numericAmount = Number(amount);

```
if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
) {
    throw new Error(
        'Valor inválido para o PIX.'
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
    normalizeText(
        orderId,
        25
    ) || '***';

const amountText =
    numericAmount.toFixed(2);

const merchantAccountInformation =
    formatField(
        '00',
        'BR.GOV.BCB.PIX'
    ) +
    formatField(
        '01',
        PIX_KEY
    );

const additionalData =
    formatField(
        '05',
        txid
    );

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
        amountText
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

payload += crc16(payload);

return payload;
```

}

export function getPixKey() {
return PIX_KEY;
}

export function getPixCity() {
return PIX_CITY;
}
