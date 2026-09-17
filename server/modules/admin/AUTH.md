# AUREA — CORE 12

## Autenticação administrativa

A API administrativa utiliza:

Authorization: Bearer <AUREA_ADMIN_TOKEN>

O token deve possuir no mínimo 32 caracteres.

## Configuração

PowerShell:

$env:AUREA_ADMIN_TOKEN = "SEU_TOKEN_FORTE"

Produção:

AUREA_ADMIN_TOKEN deve ser configurado
como variável secreta do ambiente.

Nunca colocar o token:

- no HTML
- no JavaScript público
- no Git
- no package.json
- no banco
- em arquivos enviados ao navegador

## Rotas protegidas

/ api/admin/*
/ api/inventory/*
PATCH /api/orders/:orderNumber/status

## Comportamento

Sem token:
401

Token não configurado:
503

Token válido:
acesso administrativo

## Segurança

A comparação do token utiliza
comparação em tempo constante.

Existe limitação de requisições
na camada administrativa.

PIX e checkout não foram alterados.
