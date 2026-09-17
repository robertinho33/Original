# AUREA — RUNBOOK

## Inicialização

npm ci --omit=dev

npm start

## Docker

docker compose -f compose.production.yml up -d --build

## Health

/api/health

## Readiness

/api/monitoring/readiness

## Métricas

/api/monitoring/metrics

## Backup

npm run backup:data

## Validação de ambiente

npm run validate:production

## Encerramento

O processo deve receber SIGTERM e executar
o graceful shutdown já existente.

## Ordem de recuperação

1. infraestrutura
2. variáveis de ambiente
3. armazenamento
4. servidor Node
5. health
6. readiness
7. aplicação
8. domínio

## Dados

Não apagar:

server/data/orders.json
server/data/inventory/inventory.json
server/data/audit/events.json

sem backup.

## PIX

Não alterar durante publicação.

## Checkout

Não alterar durante publicação.
