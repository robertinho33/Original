'use strict';

const { checkDatabase } = require('./postgres');
const { initializeDatabase } = require('./database/postgres-init');

async function bootstrapDatabase() {
    console.log('[DATABASE] Verificando PostgreSQL...');

    const health = await checkDatabase();

    if (health.status !== 'ok') {
        throw new Error(
            'PostgreSQL não configurado. Defina DATABASE_URL.'
        );
    }

    console.log('[DATABASE] Conexão estabelecida.');

    await initializeDatabase();

    console.log('[DATABASE] Estrutura verificada.');
}

if (require.main === module) {
    bootstrapDatabase()
        .then(() => {
            console.log('[DATABASE] Bootstrap concluído.');
        })
        .catch((error) => {
            console.error(
                '[DATABASE] Falha no bootstrap:',
                error.message
            );

            process.exitCode = 1;
        });
}

module.exports = {
    bootstrapDatabase
};
