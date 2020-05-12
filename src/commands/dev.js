const chalk = require('chalk');
const { spawn } = require('child_process');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');

const SERVER_TYPES = [
  'api',
  'ui',
];

class DevCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Start the API or UI development servers.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log('Start the API or UI development servers.');

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood dev TYPE');

    console.log(chalk.yellow('\nParameters:'));
    console.log(`  ${chalk.cyan('TYPE')}     # Which server to start (${chalk.cyan('api')} or ${chalk.cyan('ui')})`); // eslint-disable-line max-len
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  execute(args) {
    if (! isNodewoodProject()) {
      console.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const type = get(args._, 1, false);
    if (SERVER_TYPES.includes(type)) {
      spawn('sh', ['-c', `yarn dev-${type}`], { stdio: 'inherit' });
    }
    else {
      console.log(chalk.red(`Invalid server type specified: '${type}'.`));
    }
  }
}

module.exports = {
  DevCommand,
};
