'use strict';

const {
  environment
} = require('./environment');

function assertProductionConfiguration() {

  if (
    environment.isProduction &&
    environment.port < 1
  ) {
    throw new Error(
      'PORT inválida para produção.'
    );
  }
  if (!environment.isProduction) {
    return {
      valid: true,
      production: false
    };
  }

  const required = [
    'AUREA_ADMIN_TOKEN'
  ];

  const missing =
    required.filter(
      name =>
        !process.env[name]
    );

  if (missing.length > 0) {
    throw new Error(
      `Variáveis obrigatórias ausentes: ${missing.join(', ')}`
    );
  }

  if (
    String(
      process.env.AUREA_ADMIN_TOKEN
    ).length < 32
  ) {
    throw new Error(
      'AUREA_ADMIN_TOKEN deve possuir pelo menos 32 caracteres.'
    );
  }

  return {
    valid: true,
    production: true
  };
}

module.exports = {
  assertProductionConfiguration
};

