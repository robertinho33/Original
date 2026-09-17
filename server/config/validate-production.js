'use strict';

const required = [
  'NODE_ENV',
  'PORT',
  'AUREA_ADMIN_TOKEN'
];

const missing = [];

for (const name of required) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === ''
  ) {
    missing.push(name);
  }
}

if (missing.length > 0) {
  console.error(
    'Variáveis obrigatórias ausentes:'
  );

  for (const name of missing) {
    console.error(`- ${name}`);
  }

  process.exit(1);
}

if (
  process.env.NODE_ENV !== 'production'
) {
  console.error(
    'NODE_ENV precisa ser production.'
  );

  process.exit(1);
}

if (
  process.env.AUREA_ADMIN_TOKEN.length < 32
) {
  console.error(
    'AUREA_ADMIN_TOKEN deve possuir pelo menos 32 caracteres.'
  );

  process.exit(1);
}

const port =
  Number(process.env.PORT);

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  console.error(
    'PORT inválida.'
  );

  process.exit(1);
}

console.log(
  'Configuração de produção válida.'
);
