const { chmodSync } = require('fs');
const { resolve, basename } = require('path');

/**
 * @type {Array} Scripts that need to have the execution bit set after unzipping.
 */
const scripts = [
  '/wood/docker/docker-postgresql-multiple-databases/create-multiple-postgresql-databases.sh',
];

/**
 * Confirms that the working folder is the root of a Nodewood project.
 *
 * @return {Boolean}
 */
function isNodewoodProject() {
  try {
    // ".nodewood.js" should exist in the root of all Nodewood projects
    require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

    return true;
  }
  catch (error) {
    return false;
  }
}

/**
 * Gets the folder name of the current Nodewood project.
 *
 * @return {String}
 */
function getProjectName() {
  return basename(process.cwd());
}

/**
 * Fix the execution file mode of important scripts.
 *
 * @param {String} path - The path where the new project has been installed.
 */
function fixScriptsMode(path) {
  scripts.forEach((script) => chmodSync(`${path}${script}`, 0o775));
}

module.exports = {
  isNodewoodProject,
  getProjectName,
  fixScriptsMode,
};
