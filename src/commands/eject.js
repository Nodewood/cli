const chalk = require('chalk');
const { get } = require('lodash');
const { resolve, extname } = require('path');
const { pathExistsSync, copySync } = require('fs-extra');
const { trueCasePathSync } = require('true-case-path');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const { log, verbose } = require('../lib/log');

const checkExtensions = ['js', 'vue', 'css'];

class EjectCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Copies a file from the `wood` folder to the correct place in the `app` folder.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood eject \'FILE\'');

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('--overwrite')}     # Overwrite existing file in app folder`);
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

    const file = get(args._, 1, false);

    if (! file) {
      log(chalk.red('You must specify a file.  If the file begisn with #, ensure is enclosed in quotes.'));
    }

    const overwrite = get(args, 'overwrite', false);
    const woodPath = this.getWoodPath(file);
    const appPath = this.getAppPath(woodPath, overwrite);

    verbose(`Ejecting from '${woodPath}' to '${appPath}'...`);

    copySync(woodPath, appPath, { overwrite, errorOnExist: true });

    log(`File ejected to ${chalk.cyan(appPath)}`);
  }

  /**
   * Gets the full path of the file to eject from the `wood` folder.
   *
   * Throws an error if the file does not exist.
   *
   * @param {String} file - The file to get the path for.
   *
   * @return {String}
   */
  getWoodPath(file) {
    const path = resolve(process.cwd(), `wood/${file.replace('#', '')}`);

    if (extname(file) && pathExistsSync(path)) {
      return trueCasePathSync(path);
    }

    for (const ext of checkExtensions) { // eslint-disable-line no-restricted-syntax
      if (pathExistsSync(`${path}.${ext}`)) {
        return trueCasePathSync(`${path}.${ext}`);
      }
    }

    throw new Error(`Could not find file to eject at:\n${chalk.cyan(path)}\n\nPerhaps you need to specify an extension?`);
  }

  /**
   * Gets the full path of the file to write in the `app` fo.der
   *
   * Throws an error if the file already exists.
   *
   * @param {String} file - The file to get the path for.
   * @param {Boolean} overwrite - If it is safe to overwrite the app file.
   *
   * @return {String}
   */
  getAppPath(woodPath, overwrite) {
    const appPath = woodPath.replace('/wood/', '/app/');

    if (! overwrite && pathExistsSync(appPath)) {
      throw new Error(`Could not eject file, file already exists at:\n${chalk.cyan(appPath)}`);
    }

    return appPath;
  }
}

module.exports = {
  EjectCommand,
};
