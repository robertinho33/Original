# AUREA — CORE 11

## Ciclo operacional

Estados oficiais:

awaiting_payment
paid
processing
shipped
delivered
cancelled

## Transições

awaiting_payment
    ↓
paid
    ↓
processing
    ↓
shipped
    ↓
delivered

Cancelamento:

awaiting_payment → cancelled
paid → cancelled
processing → cancelled

Estados finais:

delivered
cancelled

não podem ser alterados novamente.

## API

GET /api/orders/lifecycle/states

PATCH /api/orders/:orderNumber/status

GET /api/admin/orders/:orderNumber/timeline

## Regra

Nenhuma camada deve alterar diretamente
order.status.

Toda mudança operacional passa pelo
order-lifecycle-service.

Cada mudança gera evento de auditoria.

PIX permanece separado.

Checkout permanece separado.
