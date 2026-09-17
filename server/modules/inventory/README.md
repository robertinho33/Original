# AUREA — CORE 10

## Estoque persistente

O estoque agora possui:

- estoque disponível
- estoque reservado
- reserva por pedido
- liberação de reserva
- confirmação da reserva
- baixa definitiva do estoque
- persistência em arquivo
- escrita atômica por arquivo temporário

## Estados da reserva

reserved
released
committed

## API

GET /api/inventory
GET /api/inventory/reservations

## Regra

Disponível:

stock - reserved

Uma reserva não reduz imediatamente
o estoque físico.

Quando confirmada:

stock = stock - quantity
reserved = reserved - quantity

Quando liberada:

reserved = reserved - quantity

PIX e checkout permanecem separados
desta camada.
