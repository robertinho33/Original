'use strict';

const metrics =
  require('./metrics');

function metricsMiddleware(req, res, next) {
  const startedAt =
    process.hrtime.bigint();

  metrics.increment(
    'http.requests.total'
  );

  res.on('finish', () => {
    const elapsed =
      Number(
        process.hrtime.bigint() -
        startedAt
      ) / 1e6;

    metrics.increment(
      `http.status.${res.statusCode}`
    );

    if (res.statusCode >= 400) {
      metrics.increment(
        'http.errors.total'
      );
    }

    if (elapsed >= 1000) {
      metrics.increment(
        'http.requests.slow'
      );
    }
  });

  next();
}

module.exports = {
  metricsMiddleware
};
