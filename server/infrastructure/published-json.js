'use strict';
const { readFile } = require('node:fs/promises');
// Published files change with deployments. Failed reads can be retried; concurrent reads share work.
function createPublishedJsonReader(filename, read = readFile) {
  let pending;
  return function load() {
    if (!pending) pending = Promise.resolve().then(() => read(filename, 'utf8'))
      .then(text => JSON.parse(text.replace(/^\uFEFF/, '')))
      .catch(error => { pending = undefined; throw error; });
    return pending;
  };
}
module.exports = { createPublishedJsonReader };
