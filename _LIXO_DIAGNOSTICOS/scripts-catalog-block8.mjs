import {
    discoverProductUrls,
    normalizeUrl
} from './js/catalog/catalog-discovery-utils.js';

const SOURCES = [
    {
        id: 'ecobelle',
        name: 'EcoBelle',
        urls: [
            'https://www.grupoecobelle.com.br/produtos',
            'https://www.grupoecobelle.com.br/linha-ecobelle/l',
            'https://www.grupoecobelle.com.br/compre-por-linha/l',
            'https://www.grupoecobelle.com.br/kits',
            'https://www.grupoecobelle.com.br/condicionador'
        ]
    },
    {
        id: 'brae',
        name: 'Braé',
        urls: [
            'https://www.brae.com.br/produtos',
            'https://www.brae.com.br/brae-todos-os-produtos',
            'https://www.brae.com.br/produtos-profissionais',
            'https://www.brae.com.br/produtos/tratamento',
            'https://www.brae.com.br/produtos/tipos-de-cabelo'
        ]
    },
    {
        id: 'inovax',
        name: 'Inovax',
        urls: [
            'https://loja.inovaxcosmeticos.com.br/'
        ]
    }
];

console.log('');
console.log('============================================================');
console.log(' BLOCO 8 — AUDITORIA DE DESCOBERTA');
console.log('============================================================');

for (const source of SOURCES) {
    console.log('');
    console.log(`===== ${source.name.toUpperCase()} =====`);

    try {
        const result =
            await discoverProductUrls(
                source.urls,
                {
                    maxPages:
                        source.id === 'inovax'
                            ? 35
                            : 30,

                    maxUrls: 1000
                }
            );

        const urls = [
            ...new Set(
                result.productUrls
                    .map(normalizeUrl)
                    .filter(Boolean)
            )
        ];

        console.log(
            `Páginas visitadas: ${result.visitedPages.length}`
        );

        console.log(
            `URLs de produtos descobertas: ${urls.length}`
        );

        const invalid =
            urls.filter(url =>
                url.includes('--produto_url--') ||
                url.includes('produto_url')
            );

        console.log(
            `URLs inválidas: ${invalid.length}`
        );

        if (invalid.length) {
            console.log(
                'URLs inválidas encontradas:'
            );

            console.log(
                invalid
            );
        }

        console.log('');
        console.log(
            'Primeiras URLs válidas:'
        );

        urls
            .slice(0, 15)
            .forEach((url, index) => {
                console.log(
                    `${index + 1}. ${url}`
                );
            });

    } catch (error) {
        console.error(
            `[${source.name}] Erro:`,
            error?.message || error
        );
    }
}

console.log('');
console.log('============================================================');
console.log(' AUDITORIA DE DESCOBERTA CONCLUÍDA');
console.log('============================================================');
