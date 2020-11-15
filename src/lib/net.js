const { resolve } = require('path');
const unzipper = require('unzipper');
const superagent = require('superagent');
const moment = require('moment');
const { readJsonSync, emptyDirSync } = require('fs-extra');
const { hmac } = require('../lib/hmac');
const { fixScriptsMode } = require('../lib/file');
const {
  createWriteStream,
  createReadStream,
  removeSync,
} = require('fs-extra');

/**
 * @type {String} Default characters for random strilg are just alphanumeric
 */
const DEFAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

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
 * Get a string of random characters.
 *
 * @param {Number} length - The length of the string to get.
 * @param {String} characters - The valid characters to choose from.
 *
 * @return {String}
 */
function randString(length, characters = DEFAULT_CHARACTERS) {
  const charactersLength = characters.length;

  let chosen = []; // eslint-disable-line prefer-const
  for (let i = 0; i < length; i += 1) {
    chosen.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
  }

  return chosen.join('');
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
  console.log('Installing application template...');

  const zipfile = `${path}/../template-${randString(10)}.zip`;
  const versions = await downloadZip(
    `${URL_BASE}${URL_SUFFIX_TEMPLATE}`,
    zipfile,
    apiKey,
    secretKey,
  );

  await unzipZip(zipfile, path);

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
  console.log('Installing Nodewood library...');

  const zipfile = `${path}/../wood-${randString(10)}.zip`;
  const versions = await downloadZip(
    `${URL_BASE}${URL_SUFFIX_WOOD}`,
    zipfile,
    apiKey,
    secretKey,
  );

  emptyDirSync(`${path}/wood`);
  await unzipZip(zipfile, `${path}/wood`);
  fixScriptsMode(path);

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

  removeSync(from);
}

module.exports = {
  buildRequest,
  installTemplate,
  installWood,
  URL_BASE,
};
