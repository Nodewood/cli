const { existsSync } = require('fs');
const { resolve } = require('path');
const { get } = require('lodash');

/**
 * Get the command to use for launching docker compose.
 *
 * @return {String}
 */
function getDockerCompose() {
  const config = require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

  return {
    composeCommand: get(config, 'composeCommand', 'docker-compose'),
    composeArgs: get(config, 'composeArgs', []),
  };
}

/**
 * Ensure App Docker config is used, if present.
 *
 * @return {String}
 */
function getDockerConfigFolder() {
  if (existsSync(resolve(process.cwd(), 'app/docker/docker-compose.yml'))) {
    return 'app/docker';
  }

  return 'wood/docker';
}

/**
 * Gets the name of the image to use to run commands.  Defaults to `run`, but can be configured in
 * the `.nodewood.js` file.
 *
 * @return {String}
 */
function getRunImage() {
  const config = require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

  return get(config, 'runImage', 'run');
}

module.exports = {
  getDockerCompose,
  getDockerConfigFolder,
  getRunImage,
};
