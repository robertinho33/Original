# AUREA — MANIFESTO DE DEPLOY

## Aplicação

Node.js + Express

## Inicialização

npm ci --omit=dev
npm start

## Porta

PORT

## Ambiente

NODE_ENV=production

## Segredo administrativo

AUREA_ADMIN_TOKEN

## CORS

CORS_ORIGINS

## Health

GET /api/health

## Readiness

GET /api/monitoring/readiness

## Métricas

GET /api/monitoring/metrics

## Persistência

server/data/

## Domínio

www.fiosperfeitos.com.br

## HTTPS

Obrigatório em produção.

## PIX

Não modificar durante o deploy.

## Checkout

Não modificar durante o deploy.
