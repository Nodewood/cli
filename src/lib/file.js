const { resolve } = require('path');

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

module.exports = {
  isNodewoodProject,
};
