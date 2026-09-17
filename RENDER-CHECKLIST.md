# RENDER — CHECKLIST

## Serviço

Name:
aurea-cosmetics

Runtime:
Node

Branch:
main

Build:
npm ci --omit=dev

Start:
npm start

Health:
 /api/health

## Environment

NODE_ENV=production
PORT=3000

AUREA_ADMIN_TOKEN=<Secret>

CORS_ORIGINS=https://www.fiosperfeitos.com.br,https://fiosperfeitos.com.br

## Disk

Name:
aurea-data

Mount:
 /app/server/data

Size:
10 GB

## Domain

www.fiosperfeitos.com.br

fiosperfeitos.com.br

## HTTPS

Ativo após validação do domínio.

## Antes de colocar tráfego real

[ ] Serviço criado
[ ] Build concluído
[ ] Start concluído
[ ] Health 200
[ ] Readiness operacional
[ ] Persistent Disk montado
[ ] Variáveis configuradas
[ ] Domínio validado
[ ] HTTPS ativo
[ ] CORS validado
[ ] Admin protegido
[ ] PIX preservado
[ ] Checkout preservado
