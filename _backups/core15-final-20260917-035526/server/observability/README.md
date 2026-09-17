# AUREA — CORE 13

## Observabilidade

Disponível:

GET /api/health

GET /api/monitoring/readiness

GET /api/monitoring/metrics

## Logs

Logs estruturados:

server/data/logs/application.log

Formato:

JSON por linha.

## Métricas

- http.requests.total
- http.errors.total
- http.requests.slow
- http.status.<codigo>

## Readiness

Verifica se o processo possui
acesso de leitura e escrita
ao diretório de dados.

## Produção

NODE_ENV=production

AUREA_ADMIN_TOKEN deve existir
e possuir pelo menos 32 caracteres.

Segredos devem permanecer
exclusivamente nas variáveis
do ambiente de produção.

## Regra

Logs não devem conter:

- tokens
- senhas
- chaves PIX privadas
- dados sensíveis desnecessários

PIX e checkout permanecem preservados.
