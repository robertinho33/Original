# AUREA — CORE 14

## Runtime

Node.js 22

## Produção

NODE_ENV=production

PORT=3000

AUREA_ADMIN_TOKEN=<segredo>

## Docker

Construção:

docker compose -f compose.production.yml build

Execução:

docker compose -f compose.production.yml up -d

Logs:

docker compose -f compose.production.yml logs -f aurea

Parar:

docker compose -f compose.production.yml down

## Health

/api/health

## Readiness

/api/monitoring/readiness

## Persistência

Os dados de:

server/data

são montados no volume:

aurea-data

## Regra

O segredo administrativo nunca deve
ser colocado no código-fonte.

O servidor deve ficar atrás de HTTPS
em produção.

O domínio público deve apontar para
o serviço Node que executa a aplicação.

PIX e checkout permanecem preservados.
