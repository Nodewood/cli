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

module.exports = {
  getDockerCompose,
  getDockerConfigFolder,
};
