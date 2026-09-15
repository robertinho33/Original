'use strict';

const BRAE_URL = 'https://www.brae.com.br/produtos';

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCodePoint(Number(code))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16))
        );
}

function stripHtml(value) {
    return decodeHtmlEntities(
        String(value || '')
            .replace(/\\n/g, ' ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<\/div>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/\s+/g, ' ')
        .trim();
}

function extractJsonLd(html) {
    const results = [];

    const matches = String(html || '').matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    for (const match of matches) {
        try {
            const data = JSON.parse(match[1].trim());

            if (Array.isArray(data)) {
                results.push(...data);
            } else if (data) {
                results.push(data);
            }
        } catch {
            // Ignora blocos inválidos.
        }
    }

    return results;
}

function collectBraeProducts(data) {
    const products = [];

    function visit(value) {
        if (!value || typeof value !== 'object') return;

        if (value['@type'] === 'Product') {
            products.push(value);
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item);
            }
            return;
        }

        if (Array.isArray(value.itemListElement)) {
            for (const item of value.itemListElement) {
                visit(item?.item);
            }
        }

        if (Array.isArray(value['@graph'])) {
            for (const item of value['@graph']) {
                visit(item);
            }
        }
    }

    for (const item of data) {
        visit(item);
    }

    return products;
}

function getOffer(product) {
    const offers = product?.offers;

    if (Array.isArray(offers)) {
        return offers[0] || null;
    }

    if (offers?.offers && Array.isArray(offers.offers)) {
        return offers.offers[0] || null;
    }

    return offers || null;
}

function getPrice(product) {
    const offer = getOffer(product);

    return Number(
        offer?.price ??
        offer?.lowPrice ??
        product?.price ??
        0
    ) || 0;
}

function getStock(product) {
    const offer = getOffer(product);

    const availability = String(
        offer?.availability || ''
    );

    if (/InStock/i.test(availability)) {
        return 'disponível';
    }

    if (/OutOfStock/i.test(availability)) {
        return 'esgotado';
    }

    return availability;
}

function getImage(product) {
    if (Array.isArray(product?.image)) {
        return String(product.image[0] || '').trim();
    }

    return String(product?.image || '').trim();
}

function mapBraeProduct(product) {
    return {
        sku: String(
            product?.sku ||
            product?.mpn ||
            product?.productID ||
            ''
        ).trim(),

        name: String(
            product?.name || ''
        ).trim(),

        weight: String(
            product?.weight ||
            product?.size ||
            ''
        ).trim(),

        price: getPrice(product),

        category: String(
            product?.category ||
            'Braé'
        ).trim(),

        stock: getStock(product),

        description: stripHtml(
            product?.description || ''
        ),

        image: getImage(product)
    };
}

export function extractBraeProducts(html) {
    const jsonLd = extractJsonLd(html);

    return collectBraeProducts(jsonLd);
}

export async function loadBraeProducts() {
    const response = await fetch(BRAE_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            Accept: 'text/html',
            'User-Agent': 'Mozilla/5.0'
        }
    });

    if (!response.ok) {
        throw new Error(
            `Braé: HTTP ${response.status}`
        );
    }

    const html = await response.text();

    const products = extractBraeProducts(html);

    const mapped = products
        .map(mapBraeProduct)
        .filter(product =>
            product.sku &&
            product.name &&
            product.price > 0
        );

    console.log(
        `[BRAÉ] Produtos encontrados: ${mapped.length}`
    );

    return mapped;
}

export {
    BRAE_URL,
    extractJsonLd,
    collectBraeProducts,
    mapBraeProduct,
    getOffer,
    getPrice,
    getStock,
    getImage,
    stripHtml
};
