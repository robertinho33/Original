# AUREA — Orders Core

## Responsabilidades

- criação de pedidos
- validação de itens
- autoridade de preço
- autoridade de estoque
- persistência
- consulta individual
- listagem
- request-id
- tratamento central de erros

## API

POST /api/orders
GET /api/orders
GET /api/orders/:orderNumber

## Observação

O módulo PIX existente não é substituído por esta camada.
