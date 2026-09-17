# AUREA COSMETICS — DEPLOY

## 1. GitHub

Repositório:

robertinho33/Original

Branch:

main

## 2. Render

Criar:

New
→ Blueprint

Selecionar o repositório.

A Render utilizará:

render.yaml

## 3. Secret

No serviço:

Environment

Criar:

AUREA_ADMIN_TOKEN

O valor deve possuir pelo menos
32 caracteres.

## 4. Persistent Disk

O Blueprint solicita:

Name:
aurea-data

Mount:
 /app/server/data

Size:
10 GB

## 5. Deploy

Build:

npm ci --omit=dev

Start:

npm start

## 6. Health

/api/health

## 7. Domínio

Adicionar:

www.fiosperfeitos.com.br

e:

fiosperfeitos.com.br

Os registros DNS devem ser copiados
EXATAMENTE conforme apresentados pela
Render.

## 8. HTTPS

Aguardar a validação do domínio e
emissão do certificado TLS.

## 9. Produção

URL final:

https://www.fiosperfeitos.com.br

## 10. Dados

Pedidos, inventário e auditoria devem
permanecer dentro do Persistent Disk.

## 11. PIX

Não alterar.

## 12. Checkout

Não alterar.
