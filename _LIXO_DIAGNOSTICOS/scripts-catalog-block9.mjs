import {
    discoverEcoBelle,
    discoverInovax,
    discoverBrae
} from './js/catalog/catalog-supplier-discovery.js';

const SOURCES = [
    {
        id: 'ecobelle',
        name: 'EcoBelle',
        loader: discoverEcoBelle
    },
    {
        id: 'inovax',
        name: 'Inovax',
        loader: discoverInovax
    },
    {
        id: 'brae',
        name: 'Braé',
        loader: discoverBrae
    }
];

console.log('');
console.log('============================================================');
console.log(' BLOCO 9 — AUDITORIA ESPECIALIZADA');
console.log('============================================================');

const results = [];

for (const source of SOURCES) {
    console.log('');
    console.log(`===== ${source.name.toUpperCase()} =====`);

    try {
        const result = await source.loader();

        const urls = [
            ...new Set(
                result.productUrls
                    .filter(Boolean)
            )
        ];

        const invalid = urls.filter(url => {
            const lower =
                String(url).toLowerCase();

            return (
                lower.includes('/carrinho/') ||
                lower.includes('/adicionar') ||
                lower.includes('/none-') ||
                lower.includes('produto_url') ||
                lower.includes('--produto_url--')
            );
        });

        const valid = urls.filter(
            url => !invalid.includes(url)
        );

        console.log(
            `Páginas visitadas: ${result.visitedPages.length}`
        );

        console.log(
            `URLs descobertas: ${urls.length}`
        );

        console.log(
            `URLs aceitas: ${valid.length}`
        );

        console.log(
            `URLs rejeitadas: ${invalid.length}`
        );

        if (invalid.length) {
            console.log('');
            console.log('REJEITADAS:');

            invalid
                .slice(0, 20)
                .forEach((url, index) => {
                    console.log(
                        `${index + 1}. ${url}`
                    );
                });
        }

        console.log('');
        console.log('PRIMEIRAS URLs ACEITAS:');

        valid
            .slice(0, 20)
            .forEach((url, index) => {
                console.log(
                    `${index + 1}. ${url}`
                );
            });

        results.push({
            id: source.id,
            name: source.name,
            visited: result.visitedPages.length,
            discovered: urls.length,
            accepted: valid.length,
            rejected: invalid.length
        });

    } catch (error) {
        console.error(
            `[ERRO] ${source.name}:`,
            error?.message || error
        );

        results.push({
            id: source.id,
            name: source.name,
            visited: 0,
            discovered: 0,
            accepted: 0,
            rejected: 0,
            error: error?.message || String(error)
        });
    }
}

console.log('');
console.log('============================================================');
console.log(' RESUMO DO BLOCO 9');
console.log('============================================================');

for (const result of results) {
    console.log(
        `${result.name}: ` +
        `${result.accepted} aceitas | ` +
        `${result.rejected} rejeitadas | ` +
        `${result.visited} páginas`
    );
}

console.log('');
console.log('Nenhum produto foi gravado em data/catalog.json.');
console.log('Carrinho, checkout, PIX e pedidos não foram alterados.');
console.log('============================================================');
