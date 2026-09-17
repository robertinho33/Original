# AUREA — CORE 09

## Operação administrativa

Endpoints:

GET /api/admin/dashboard
GET /api/admin/orders
GET /api/admin/orders/:orderNumber
GET /api/admin/audit

## Dashboard

O dashboard administrativo consolida:

- quantidade total de pedidos
- pedidos pendentes
- pedidos confirmados
- pedidos concluídos
- pedidos cancelados
- receita registrada

## Pedidos

A operação administrativa pode consultar pedidos por:

status

email

número do pedido

## Auditoria

A trilha de auditoria permanece separada do fluxo
do checkout e do PIX.

## Regra

O administrador nunca deve alterar diretamente:

- preço calculado pelo servidor
- PIX
- dados originais do pedido
- histórico de auditoria

Alterações operacionais devem passar pelos serviços
e pelas transições de estado do domínio.
