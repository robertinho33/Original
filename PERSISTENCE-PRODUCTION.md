# PERSISTÊNCIA — AUREA

A aplicação utiliza:

/app/server/data

O Persistent Disk da Render será montado em:

/app/server/data

Isso preserva:

server/data/orders.json

server/data/inventory/inventory.json

server/data/audit/events.json

server/data/logs/

## REGRA

Não usar o filesystem efêmero do serviço
para dados permanentes.

O Persistent Disk é obrigatório enquanto
a aplicação utilizar arquivos JSON como
armazenamento operacional.

## BACKUP

Persistent Disk não substitui backup externo.

O backup operacional continua sendo:

npm run backup:data

Para produção real, os backups devem ser
copiados para armazenamento externo.
