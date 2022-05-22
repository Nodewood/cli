const chalk = require('chalk');
const spawn = require('cross-spawn');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');
const { log } = require('../lib/log');

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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood rollback');

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('--test')}  # Rollback migrations against test database.`);
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

    const { composeCommand, composeArgs } = getDockerCompose();
    const dockerFolder = getDockerConfigFolder();
    const projectName = getProjectName();

    const env = get(args, 'test', false) ? '-test' : '';
    spawn(composeCommand, [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'run', '--rm', 'api', '/bin/bash', '-c', `yarn rollback${env}`], { stdio: 'inherit' });
  }
}

module.exports = {
  RollbackCommand,
};
