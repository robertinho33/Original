'use strict';

const http = require('http');

const port =
  Number(
    process.env.PORT || 3000
  );

const request =
  http.get(
    `http://127.0.0.1:${port}/api/health`,
    response => {
      process.exit(
        response.statusCode === 200
          ? 0
          : 1
      );
    }
  );

request.on(
  'error',
  () => process.exit(1)
);

request.setTimeout(
  5000,
  () => {
    request.destroy();
    process.exit(1);
  }
);
