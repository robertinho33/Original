'use strict';

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function requestIdMiddleware(req, res, next) {
  const id = req.get('x-request-id') || createRequestId();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

module.exports = { createRequestId, requestIdMiddleware };
