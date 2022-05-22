const chalk = require('chalk');
const spawn = require('cross-spawn');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');

class SeedCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Runs all DB seeds.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    this.log(this.helpLine());

    this.log(chalk.yellow('\nUsage:'));
    this.log('  nodewood seed');
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

    spawn(composeCommand, [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'run', '--rm', 'api', '/bin/bash', '-c', 'yarn seed'], { stdio: 'inherit' });
  }
}

module.exports = {
  SeedCommand,
};
