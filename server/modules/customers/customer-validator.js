'use strict';

const { AppError } = require('../../core/app-error');

function normalizeCustomer(customer = {}) {
  const name = String(
    customer.name ??
    customer.nome ??
    ''
  ).trim();

  const email = String(
    customer.email ??
    ''
  ).trim().toLowerCase();

  const phone = String(
    customer.phone ??
    customer.telefone ??
    ''
  ).trim();

  if (!name) {
    throw new AppError(
      'Nome do cliente não informado.',
      {
        code: 'CUSTOMER_NAME_REQUIRED',
        status: 400
      }
    );
  }

  if (!email) {
    throw new AppError(
      'E-mail do cliente não informado.',
      {
        code: 'CUSTOMER_EMAIL_REQUIRED',
        status: 400
      }
    );
  }

  if (!email.includes('@')) {
    throw new AppError(
      'E-mail do cliente inválido.',
      {
        code: 'CUSTOMER_EMAIL_INVALID',
        status: 400
      }
    );
  }

  return {
    name,
    email,
    phone
  };
}

module.exports = {
  normalizeCustomer
};
