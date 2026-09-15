'use strict';

export function auditCatalogProducts(
    products = []
) {
    const report = {
        total: products.length,

        valid: 0,
        invalid: 0,

        withoutSku: 0,
        withoutName: 0,
        withoutPrice: 0,
        withoutImage: 0,
        withoutSource: 0,

        inactive: 0,
        featured: 0,

        bySource: {},

        duplicatedSku: [],
        duplicatedUrl: []
    };

    const skuMap = new Map();
    const urlMap = new Map();

    for (const product of products) {
        if (!product?.sku) {
            report.withoutSku++;
        }

        if (!product?.name) {
            report.withoutName++;
        }

        if (!(Number(product?.price) > 0)) {
            report.withoutPrice++;
        }

        if (!product?.image) {
            report.withoutImage++;
        }

        if (!product?.sourceId) {
            report.withoutSource++;
        }

        if (product?.active === false) {
            report.inactive++;
        }

        if (product?.featured === true) {
            report.featured++;
        }

        const sourceId =
            String(
                product?.sourceId || 'sem-fonte'
            )
                .trim()
                .toLowerCase();

        if (!report.bySource[sourceId]) {
            report.bySource[sourceId] = {
                total: 0,
                active: 0,
                featured: 0
            };
        }

        report.bySource[sourceId].total++;

        if (product?.active !== false) {
            report.bySource[sourceId].active++;
        }

        if (product?.featured === true) {
            report.bySource[sourceId].featured++;
        }

        const sku =
            String(
                product?.sku || ''
            )
                .trim()
                .toUpperCase();

        if (sku) {
            if (!skuMap.has(sku)) {
                skuMap.set(sku, []);
            }

            skuMap.get(sku).push(product);
        }

        const url =
            String(
                product?.sourceUrl || ''
            )
                .trim()
                .toLowerCase();

        if (url) {
            if (!urlMap.has(url)) {
                urlMap.set(url, []);
            }

            urlMap.get(url).push(product);
        }

        const isValid =
            Boolean(
                product?.sku &&
                product?.name &&
                Number(product?.price) > 0 &&
                product?.image &&
                product?.sourceId
            );

        if (isValid) {
            report.valid++;
        } else {
            report.invalid++;
        }
    }

    for (const [sku, items] of skuMap) {
        if (items.length > 1) {
            report.duplicatedSku.push({
                sku,
                count: items.length,
                products: items.map(
                    product => ({
                        name: product.name,
                        sourceId: product.sourceId,
                        sourceName: product.sourceName
                    })
                )
            });
        }
    }

    for (const [url, items] of urlMap) {
        if (items.length > 1) {
            report.duplicatedUrl.push({
                url,
                count: items.length,
                products: items.map(
                    product => ({
                        sku: product.sku,
                        name: product.name,
                        sourceId: product.sourceId
                    })
                )
            });
        }
    }

    return report;
}
