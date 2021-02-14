const chalk = require('chalk');
const spawn = require('cross-spawn');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');

class MigrateCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Runs outstanding migrations.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood migrate');

    console.log(chalk.yellow('\nOptions:'));
    console.log(`  ${chalk.cyan('--test')}  # Run migrations against test database.`);
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

    const { composeCommand, composeArgs } = getDockerCompose();
    const dockerFolder = getDockerConfigFolder();
    const projectName = getProjectName();

    const env = get(args, 'test', false) ? '-test' : '';
    spawn(composeCommand, [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'run', '--rm', 'api', '/bin/bash', '-c', `yarn migrate${env}`], { stdio: 'inherit' });
  }
}

module.exports = {
  MigrateCommand,
};
