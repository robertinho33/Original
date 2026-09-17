'use strict';

const { AppError } = require('../../core/app-error');

function normalizeCep(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

function normalizeAddress(address = {}) {
  const cep = normalizeCep(
    address.cep ??
    address.CEP
  );

  const street = String(
    address.street ??
    address.rua ??
    ''
  ).trim();

  const number = String(
    address.number ??
    address.numero ??
    ''
  ).trim();

  const neighborhood = String(
    address.neighborhood ??
    address.bairro ??
    ''
  ).trim();

  const city = String(
    address.city ??
    address.cidade ??
    ''
  ).trim();

  const state = String(
    address.state ??
    address.estado ??
    ''
  ).trim().toUpperCase();

  const complement = String(
    address.complement ??
    address.complemento ??
    ''
  ).trim();

  if (!/^\d{8}$/.test(cep)) {
    throw new AppError(
      'CEP inválido.',
      {
        code: 'INVALID_CEP',
        status: 400
      }
    );
  }

  if (!street || !city || !state) {
    throw new AppError(
      'Endereço incompleto.',
      {
        code: 'ADDRESS_INCOMPLETE',
        status: 400
      }
    );
  }

  if (state.length !== 2) {
    throw new AppError(
      'UF inválida.',
      {
        code: 'INVALID_STATE',
        status: 400
      }
    );
  }

  return {
    cep,
    street,
    number,
    neighborhood,
    city,
    state,
    complement
  };
}

module.exports = {
  normalizeCep,
  normalizeAddress
};
