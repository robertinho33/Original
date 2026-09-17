'use strict';

const { environment } =
  require('./environment');

function configureProxy(app) {

  if (
    environment.isProduction
  ) {
    app.set(
      'trust proxy',
      1
    );
  }

  return app;
}

module.exports = {
  configureProxy
};
