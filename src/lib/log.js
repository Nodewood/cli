const { get } = require('lodash');
const args = require('minimist')(process.argv.slice(2));

const verboseMode = get(args, 'v', false);

/**
 * Logs a message under all conditions.
 *
 * @param {String} message - The message to log.
 */
function log(message) {
  console.log(message);
}

/**
 * Logs a message when the verbose (-v) flag is set.
 *
 * @param {String} message - The message to log.
 */
function verbose(message) {
  if (verboseMode) {
    console.log(message);
  }
}

module.exports = {
  log,
  verbose,
};
