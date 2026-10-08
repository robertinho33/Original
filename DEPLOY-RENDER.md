# NEFER COSMETICS — DEPLOY

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

NEFER_ADMIN_TOKEN

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

## 4.1 WhatsApp de pedidos

Para enviar automaticamente a confirmação ao WhatsApp do cliente, configure no
serviço Render as variáveis `NEFER_WHATSAPP_ACCESS_TOKEN`,
`NEFER_WHATSAPP_PHONE_NUMBER_ID`, `NEFER_WHATSAPP_ORDER_TEMPLATE`,
`NEFER_WHATSAPP_TEMPLATE_LANGUAGE` (por exemplo, `pt_BR`) e
`NEFER_WHATSAPP_GRAPH_API_VERSION` com valores da WhatsApp Business Cloud API.

Crie e aprove na Meta um modelo da categoria Utility, em português, com duas
variáveis no corpo: nome do cliente (`{{1}}`) e detalhes do pedido (`{{2}}`).
Sem as credenciais, o modelo aprovado ou o aceite do cliente no checkout, o
pedido é salvo normalmente e nenhuma mensagem é enviada.

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
