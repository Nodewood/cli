const { resolve } = require('path');
const superagent = require('superagent');
const moment = require('moment');
const { readJsonSync } = require('fs-extra');
const { hmac } = require('../lib/hmac');

/**
 * Build a request that can be awaited or streamed.
 *
 * @param {String} method - The HTTP method to use for the request.
 * @param {String} url - The URL of the request.
 * @param {String} apiKey - The API Key to send with the request.
 * @param {String} secretKey - The Secret Key to use to sign the request.
 *
 * @return {Reequest}
 */
function buildRequest(method, url, apiKey, secretKey) {
  const packageObj = readJsonSync(resolve(__dirname, '../../package.json'));
  const ts = moment().format();
  const request = superagent(method, url)
    .set('api-key', apiKey)
    .set('ts', ts)
    .set('cli-version', packageObj.version)
    .set('hmac-hash', hmac({ apiKey }, ts, secretKey));

  // If a custom domain has been set, no point in strictly checking SSL certs
  if (process.env.NODEWOOD_DOMAIN) {
    request.disableTLSCerts();
  }

  return request;
}

module.exports = {
  buildRequest,
  URL_BASE: `https://${process.env.NODEWOOD_DOMAIN || 'nodewood.com'}/api/public`,
};
