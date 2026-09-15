'use strict';

export const catalogSources = [
    {
        id: 'ecobelle',
        name: 'EcoBelle',
        url: 'https://www.grupoecobelle.com.br/produtos',
        file: 'EcoBelle.csv',
        enabled: true,
        visible: true,
        featured: true
    },
    {
        id: 'inovax',
        name: 'Inovax',
        url: 'https://loja.inovaxcosmeticos.com.br/',
        file: 'Inovax.csv',
        enabled: true,
        visible: true,
        featured: true
    },
    {
        id: 'brae',
        name: 'Braé',
        url: 'https://www.brae.com.br/produtos',
        file: 'Brae.csv',
        enabled: true,
        visible: true,
        featured: true
    }
];

export function getEnabledCatalogSources() {
    return catalogSources.filter(
        source =>
            source.enabled === true
    );
}

export function getVisibleCatalogSources() {
    return catalogSources.filter(
        source =>
            source.enabled === true &&
            source.visible === true
    );
}

export function getFeaturedCatalogSources() {
    return catalogSources.filter(
        source =>
            source.enabled === true &&
            source.visible === true &&
            source.featured === true
    );
}

export function getCatalogSource(
    sourceId
) {
    const normalized =
        String(sourceId || '')
            .trim()
            .toLowerCase();

    return catalogSources.find(
        source =>
            source.id === normalized
    ) || null;
}

