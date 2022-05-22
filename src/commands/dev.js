const chalk = require('chalk');
const spawn = require('cross-spawn');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');

class DevCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Start the development server using docker-compose.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    this.log(this.helpLine());

    this.log(chalk.yellow('\nUsage:'));
    this.log('  nodewood dev');

    this.log(chalk.yellow('\nOptions:'));
    this.log(`  ${chalk.cyan('-d')}    # Run in detached (background) mode.`);
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      this.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const { composeCommand, composeArgs } = getDockerCompose();
    const dockerFolder = getDockerConfigFolder();
    const projectName = getProjectName();
    const spawnArgs = [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'up'];

    // Detached mode
    if (get(args, 'd', false)) {
      spawnArgs.push('-d');
    }

    spawn(composeCommand, spawnArgs, { stdio: 'inherit' });
  }
}

module.exports = {
  DevCommand,
};
