# PERSISTÊNCIA PostgreSQL — AUREA COSMETICS

## Objetivo

Substituir progressivamente o armazenamento de pedidos baseado em arquivos
por PostgreSQL persistente.

## Componentes

- server/infrastructure/postgres.js
- server/infrastructure/database/schema.sql
- server/infrastructure/database/postgres-init.js
- server/infrastructure/database/bootstrap.js
- server/infrastructure/database/migrate-orders.js
- server/modules/orders/postgres-order-repository.js

## Variável obrigatória

DATABASE_URL

Exemplo:

postgresql://USER:PASSWORD@HOST:5432/DATABASE

## Comandos

Inicializar estrutura:

npm run db:init

Migrar pedidos existentes:

npm run db:migrate:orders

## Segurança

Nunca versionar:

- DATABASE_URL
- senha do banco
- credenciais administrativas
- tokens
- chaves privadas

## Migração

O arquivo server/data/orders.json permanece intacto durante a migração.

A migração utiliza order_number como identificador único e não duplica
pedidos já existentes.

## Próxima integração

Depois que o PostgreSQL estiver provisionado e a migração validada,
o repository PostgreSQL poderá substituir progressivamente o repository
JSON através de uma camada de persistência configurável.

PIX e checkout permanecem independentes desta etapa.
