'use strict';

const {
  AppError
} = require('./app-error');

const {
  getAdminToken,
  hasAdminToken,
  safeCompare
} = require('../config/admin-auth');

function extractBearerToken(req) {
  const header =
    String(
      req.get('authorization') || ''
    ).trim();

  if (!header) {
    return '';
  }

  const match =
    header.match(
      /^Bearer\s+(.+)$/i
    );

  return match
    ? match[1].trim()
    : '';
}

function requireAdmin(req, res, next) {
  const configured =
    hasAdminToken();

  if (!configured) {
    return next(
      new AppError(
        'A autenticação administrativa não está configurada.',
        {
          code: 'ADMIN_AUTH_NOT_CONFIGURED',
          status: 503
        }
      )
    );
  }

  const supplied =
    extractBearerToken(req);

  const expected =
    getAdminToken();

  if (
    !supplied ||
    !safeCompare(
      supplied,
      expected
    )
  ) {
    return next(
      new AppError(
        'Acesso administrativo não autorizado.',
        {
          code: 'ADMIN_UNAUTHORIZED',
          status: 401
        }
      )
    );
  }

  req.user = {
    role: 'admin',
    authenticated: true
  };

  return next();
}

function requireRole(role) {
  return function roleMiddleware(
    req,
    res,
    next
  ) {
    if (
      !req.user ||
      req.user.role !== role
    ) {
      return next(
        new AppError(
          'Permissão insuficiente.',
          {
            code: 'INSUFFICIENT_ROLE',
            status: 403
          }
        )
      );
    }

    return next();
  };
}

module.exports = {
  requireAdmin,
  requireRole,
  extractBearerToken
};
