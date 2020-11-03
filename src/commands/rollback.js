const chalk = require('chalk');
const { spawn } = require('child_process');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');

class RollbackCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Rolls back most-recent migrations.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood rollback');

    console.log(chalk.yellow('\nOptions:'));
    console.log(`  ${chalk.cyan('--test')}  # Rollback migrations against test database.`);
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

    const env = get(args, 'test', false) ? '-test' : '';
    spawn('sh', ['-c', `docker-compose run api /bin/bash -c "yarn rollback${env}"`], { stdio: 'inherit' });
  }
}

module.exports = {
  RollbackCommand,
};
