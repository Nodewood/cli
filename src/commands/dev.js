const chalk = require('chalk');
const { spawn } = require('child_process');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const { getDockerConfigFolder } = require('../lib/docker');

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
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood dev');
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

    const dockerFolder = getDockerConfigFolder();

    spawn('sh', ['-c', `docker-compose -f ${dockerFolder}/docker-compose.yml up`], { stdio: 'inherit' });
  }
}

module.exports = {
  DevCommand,
};
