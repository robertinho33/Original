# AUREA COSMETICS
# CHECKLIST OPERACIONAL DE PUBLICAÇÃO

## 1. SERVIDOR

Runtime:
Node.js 22

Entrada:
node server.js

Produção:
NODE_ENV=production

Porta:
PORT

## 2. VARIÁVEIS OBRIGATÓRIAS

NODE_ENV=production
PORT=3000
AUREA_ADMIN_TOKEN=<segredo>

## 3. SEGURANÇA

[ ] HTTPS ativo
[ ] Token administrativo configurado no ambiente
[ ] .env não publicado
[ ] CORS configurado conforme domínio oficial
[ ] Proxy reverso configurado
[ ] Logs monitorados

## 4. PERSISTÊNCIA

server/data/

Contém dados operacionais da aplicação.

Em produção deve existir armazenamento persistente.

## 5. MONITORAMENTO

Health:
GET /api/health

Readiness:
GET /api/monitoring/readiness

Metrics:
GET /api/monitoring/metrics

## 6. ADMIN

Endpoints administrativos exigem:

Authorization: Bearer <AUREA_ADMIN_TOKEN>

## 7. DOMÍNIO

Domínio público deve apontar para o
servidor Node/Express.

A aplicação não deve depender de
Live Server ou localhost.

## 8. PIX

PIX existente preservado.

Endpoint existente:
POST /api/create-pix-payment

Não substituir o provedor atual sem
uma migração específica.

## 9. CHECKOUT

Checkout existente preservado.

Fluxo:

produto
→ carrinho
→ checkout
→ endereço
→ frete/retirada
→ PIX
→ pedido

## 10. BACKUP

Executar:

node server/observability/backup-data.js

Antes de alterações estruturais.

## 11. INCIDENTE

Em caso de falha:

1. verificar /api/health
2. verificar /api/monitoring/readiness
3. consultar logs
4. verificar armazenamento
5. verificar variáveis de ambiente
6. verificar serviço Node

## 12. REGRA DE PRODUÇÃO

Nunca editar dados diretamente
no servidor sem backup.

Nunca armazenar segredos no Git.

Nunca executar produção usando
Live Server.

Nunca alterar PIX durante deploy
sem uma mudança controlada.
