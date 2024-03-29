const chalk = require('chalk');
const { readJsonSync } = require('fs-extra');
const { resolve } = require('path');
const { get, head } = require('lodash');
const { gt, lte } = require('semver');
const { prompt } = require('inquirer');
const { Command } = require('../lib/Command');
const {
  isNodewoodProject,
  getTailwindClassList,
  updateTailwindClasses,
  yarnInstall,
} = require('../lib/file');
const {
  buildRequest,
  installWood,
  URL_BASE,
} = require('../lib/net');
const { updateAppDependencies } = require('../lib/package');
const { log, verbose } = require('../lib/log');

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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood up         # Updates your Nodewood installation to the latest available version');
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const { apiKey, secretKey } = require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

    verbose(`Got API key:    '${apiKey.substr(0, 3)}...'`);
    verbose(`Got Secret key: '${secretKey.substr(0, 3)}...'`);

    const { version: currentWoodVersion } = readJsonSync(resolve(process.cwd(), 'wood/package.json'));
    const { releases, latestUserVersion } = await getReleaseInfo(apiKey, secretKey);
    const latest = head(releases);

    // User is up to date
    if (latest.version === currentWoodVersion) {
      log(chalk.yellow('You are already up to date.'));
      return;
    }

    const validReleases = getValidReleases(releases, currentWoodVersion, latestUserVersion);

    // If there are no valid releases, let user know and exit
    if (validReleases.length === 0) {
      alertUserNoValidReleases(latest.version);
      return;
    }

    const targetRelease = head(validReleases);

    // User cannot download the latest version, warn them
    if (latest.version !== latestUserVersion) {
      warnUserLicenseExpired(targetRelease.version, latest.version);
    }

    displayMigrationNotes(validReleases);

    if (! await confirmUpgradeTo(targetRelease.version)) {
      return;
    }

    await installWood(process.cwd(), apiKey, secretKey);

    addTailwindPrefix();

    updateAppDependencies();
    yarnInstall(process.cwd());

    log(`\nYour Nodewood installation has been upgraded to ${chalk.cyan(targetRelease.version)}.`);
    log(`\nYou may need to add the ${chalk.cyan('--no-verify')} flag to your next git commit, since it will try to prevent you from committing any changes to your ${chalk.cyan('wood')} folder.`);
  }
}

/**
 * Get releases & latest user version info from Nodewood.com server.
 *
 * @param {String} apiKey - The API Key for the project.
 * @param {String} secretKey - The Secret Key for the project.
 *
 * @return { releases, latestUserVersion }
 */
async function getReleaseInfo(apiKey, secretKey) {
  const response = await buildRequest(
    'GET',
    `${URL_BASE}/releases/wood`,
    apiKey,
    secretKey,
  );

  return response.body.data;
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

/**
 * Alert the user that their license has expired and there are no valid releases for them to
 * download.
 *
 * @param {String} latestVersion - The latest version available to anyone (just not the user).
 */
function alertUserNoValidReleases(latestVersion) {
  log(chalk.red('Your Nodewood upgrade license has expired and you cannot upgrade to any available versions.')); // eslint-disable-line max-len
  log(`The most-recent library version available to update to is: ${chalk.cyan(latestVersion)}.`);
  log('If you wish to purchase another year of updates, please visit https://nodewood.com');
}


/**
 * Warn the user their license has expired and the latest version available to them is not the
 * latest possible version.
 *
 * @param {String} targetVersion - The latest version available to the user.
 * @param {String} latestVersion - The latest version available to anyone (just not the user).
 */
function warnUserLicenseExpired(targetVersion, latestVersion) {
  log(chalk.yellow('Your Nodewood upgrade license has expired and you cannot upgrade to the latest version.')); // eslint-disable-line max-len
  log(`You will be upgraded to the latest version available to your license, which is: ${chalk.cyan(targetVersion)}.`); // eslint-disable-line max-len
  log(`The most-recent library version available to update to is: ${chalk.cyan(latestVersion)}.`);
  log('If you wish to purchase another year of updates, please visit https://nodewood.com');
}

/**
 * Display the migration notes for the provided releases.
 *
 * @param {Array} releases - The releases to display the migration notes for.
 */
function displayMigrationNotes(releases) {
  log(chalk.green('Migration Notes:\n'));

  releases.forEach((release) => {
    log(`Version: ${chalk.cyan(release.version)}`);
    log(`${release.migration_notes}\n`);
  });
}

/**
 * Confirm if the user wants to upgrade to the provided version.
 *
 * @param {String} version - The version being upgraded to.
 *
 * @return {boolean}
 */
async function confirmUpgradeTo(version) {
  const answers = await prompt({
    name: 'confirm',
    type: 'confirm',
    message: `Do you wish to upgrade to version ${chalk.cyan(version)}?`,
  });

  return answers.confirm;
}

/**
 * If a Tailwind prefix is specified, add that prefix to all files in `wood`.
 */
function addTailwindPrefix() {
  const prefix = getTailwindPrefix();
  if (prefix !== false) {
    log(`Adding prefix '${chalk.cyan(prefix)}' to Tailwind CSS classes...`);
    const classList = getTailwindClassList();
    updateTailwindClasses(resolve(process.cwd(), 'wood'), prefix, classList);
  }
}

/**
 * Get the prefix defined for Tailwind classes, if any.
 *
 * @return {String|Boolean}
 */
function getTailwindPrefix() {
  const tailwindConfig = require(resolve(process.cwd(), 'app/tailwind.config.js')); // eslint-disable-line global-require

  return get(tailwindConfig, 'prefix', false);
}

module.exports = {
  UpCommand,
};
