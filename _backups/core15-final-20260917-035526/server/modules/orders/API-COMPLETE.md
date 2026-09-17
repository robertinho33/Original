# AUREA — Complete Order API

## POST /api/orders/complete

Exemplo de payload:

{
  "items": [
    {
      "sku": "VEHZKS3RJ",
      "quantity": 1
    }
  ],
  "customer": {
    "name": "Cliente",
    "email": "cliente@example.com",
    "phone": "11999999999"
  },
  "address": {
    "cep": "01010010",
    "street": "Rua Exemplo",
    "number": "100",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP"
  },
  "deliveryMethod": "delivery",
  "paymentMethod": "pix"
}

O servidor:

1. valida cliente
2. valida endereço
3. calcula frete
4. consulta produto
5. obtém preço do catálogo
6. verifica estoque
7. calcula subtotal
8. calcula total
9. cria pedido
10. reserva estoque
11. cria intenção de pagamento
12. associa referência PIX
13. registra auditoria
14. confirma o pedido

O endpoint PIX existente permanece separado.
