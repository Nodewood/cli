const { resolve } = require('path');
const unzipper = require('unzipper');
const superagent = require('superagent');
const moment = require('moment');
const { readJsonSync, emptyDirSync } = require('fs-extra');
const { hmac } = require('../lib/hmac');
const {
  createWriteStream,
  createReadStream,
  remove,
} = require('fs-extra');

const URL_BASE = `https://${process.env.NODEWOOD_DOMAIN || 'nodewood.com'}/api/public`;
const URL_SUFFIX_TEMPLATE = '/releases/templates/latest/download';
const URL_SUFFIX_WOOD = '/releases/wood/latest/download';

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

/**
 * Fetch the latest template from the Nodewood server and write it to the provided path.
 *
 * @param {String} path - The path to write the template to.
 * @param {String} apiKey - The API key to pass to the Nodewood server.
 * @param {String} secretKey - The Secret Key to generate an HMAC hash with.
 *
 * @return { downloaded, latest } The downloaded and latest-possible version of the template.
 */
async function installTemplate(path, apiKey, secretKey) {
  const versions = await downloadZip(
    `${URL_BASE}${URL_SUFFIX_TEMPLATE}`,
    `${path}/template.zip`,
    apiKey,
    secretKey,
  );

  await unzipZip(`${path}/template.zip`, path);

  return versions;
}

/**
 * Fetch the latest `wood` directory from the Nodewood server and write it to the provided path.
 *
 * @param {String} path - The path to write the `wood` directory to.
 * @param {String} apiKey - The API key to pass to the Nodewood server.
 * @param {String} secretKey - The Secret key to generate an HMAC hash with.
 *
 * @return { downloaded, latest } The downloaded and latest-possible version of wood.
 */
async function installWood(path, apiKey, secretKey) {
  const versions = await downloadZip(
    `${URL_BASE}${URL_SUFFIX_WOOD}`,
    `${path}/wood.zip`,
    apiKey,
    secretKey,
  );

  emptyDirSync(`${path}/wood`);
  await unzipZip(`${path}/wood.zip`, `${path}/wood`);

  return versions;
}

/**
 * Download a zip from the Nodewood server.
 *
 * @param {String} from - The URL to download from.
 * @param {String} to - The locaction to put the zip file.
 * @param {String} apiKey - The API key to pass to the Nodewood server.
 * @param {String} secretKey - The Secret Key to generate an HMAC hash with.
 *
 * @return { downloaded, latest } The downloaded and latest-possible version of the zip.
 */
async function downloadZip(from, to, apiKey, secretKey) {
  const versions = await new Promise((promiseResolve, promisReject) => {
    const request = buildRequest('GET', from, apiKey, secretKey);

    request.on('error', promisReject);

    request.on('response', (response) => {
      if (response.status === 200) {
        const writer = createWriteStream(to);
        writer.write(response.body);
        promiseResolve({
          downloaded: response.headers['downloaded-version'],
          latest: response.headers['latest-version'],
        });
      }
      else {
        request.abort();
      }
    });

    request.end();
  });

  return versions;
}

/**
 * Unzip a local zip file and deletes it.
 *
 * @param {String} from - The location of the zip file.
 * @param {String} to - Where to unzip to.
 */
async function unzipZip(from, to) {
  await new Promise((promiseResolve, promisReject) => {
    createReadStream(from)
      .pipe(unzipper.Extract({ path: to }))
      .on('finish', promiseResolve)
      .on('error', promisReject);
  });

  await remove(from);
}

module.exports = {
  buildRequest,
  installTemplate,
  installWood,
  URL_BASE,
};
