const chalk = require('chalk');
const { readJsonSync } = require('fs-extra');
const { resolve } = require('path');
const { last } = require('lodash');
const { gt, lte } = require('semver');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const { buildRequest, URL_BASE } = require('../lib/net');

class UpCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Upgrade your Nodewood installation (\'wood\' folder).';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood up');
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      console.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const { version: currentWoodVersion } = readJsonSync(resolve(process.cwd(), 'wood/package.json'));
    const { apiKey, secretKey } = require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

    const response = await buildRequest(
      'GET',
      `${URL_BASE}/releases/wood`,
      apiKey,
      secretKey,
    );

    const releases = response.body.data.releases;
    const latest = last(releases);
    const latestUserVersion = response.body.data.latestUserVersion;

    // User is up to date
    if (latest.version === currentWoodVersion) {
      console.log(chalk.yellow('You are already up to date.'));
      return;
    }

    // Get all releases
    const validReleases = getValidReleases(releases, currentWoodVersion, latestUserVersion);

    // If there are no valid releases, let user know and exit;
    if (validReleases.length === 0) {
      console.log(chalk.red('Your Nodewood upgrade license has expired and you cannot upgrade to any available versions.')); // eslint-disable-line max-len
      console.log(`The most-recent version is: ${chalk.cyan(latest.version)}.`);
      console.log('If you wish to purchase another year of updates, please visit https://nodewood.com');
      return;
    }

    const targetRelease = last(validReleases);

    // User cannot download the latest version, warn them
    if (latest.version !== latestUserVersion) {
      console.log(chalk.yellow('Your Nodewood upgrade license has expired and you cannot upgrade to the latest version.')); // eslint-disable-line max-len
      console.log(`You will be upgraded to the latest version available to your license, which is: ${chalk.cyan(targetRelease.version)}.`); // eslint-disable-line max-len
      console.log(`The most-recent version is: ${chalk.cyan(latest.version)}.`);
      console.log('If you wish to purchase another year of updates, please visit https://nodewood.com');
    }

    console.log(chalk.green('Migration Notes:\n'));

    validReleases.forEach((release) => {
      console.log(`Version: ${chalk.cyan(release.version)}`);
      console.log(`${release.migration_notes}\n`);
    });

    // confirm user wants to upgrade
    // download latest version
    // empty wood folder
    // unzip into wood folder
    // message

    console.log('upgrade go here!');
  }
}

/**
 * Gets a list of valid releases a user can download.
 *
 * @param {Array} releases - The list of releases to filter.
 * @param {String} currentWoodVersion - The version of the current wood release the user has.
 * @param {String} latestUserVersion - The latest available version available to the user.
 *
 * @return {Array}
 */
function getValidReleases(releases, currentWoodVersion, latestUserVersion) {
  return releases.filter(
    (release) => gt(release.version, currentWoodVersion) && lte(release.version, latestUserVersion),
  );
}

module.exports = {
  UpCommand,
};
