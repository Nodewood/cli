const { existsSync } = require('fs');
const { resolve } = require('path');

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
  getDockerConfigFolder,
};
