'use strict';

const { requestIdMiddleware } = require('./request-id');
const { securityHeaders } = require('../infrastructure/security');
const { httpLogger } = require('../infrastructure/http-logger');
const { healthCheck } = require('./health');
const { idempotencyMiddleware } = require('./idempotency');
const { metricsMiddleware } = require('../observability/metrics-middleware');

function applyHttpFoundation(app) {
  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(securityHeaders);
  app.use(httpLogger);
  app.use(metricsMiddleware);
  app.use(idempotencyMiddleware);

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      ...healthCheck(),
      requestId: req.requestId
    });
  });
}

module.exports = { applyHttpFoundation };


