'use strict';

const fs = require('fs');
const path = require('path');
const { query } = require('../postgres');

const schemaPath = path.join(__dirname, 'schema.sql');

async function initializeDatabase() {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await query(schema);

    console.log('[DATABASE] PostgreSQL inicializado.');
}

module.exports = {
    initializeDatabase
};
