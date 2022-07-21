const chalk = require('chalk');
const spawn = require('cross-spawn');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder, getRunImage } = require('../lib/docker');
const { log, verbose } = require('../lib/log');

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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood seed');
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
    const spawnArgs = [...composeArgs, '-p', getProjectName(), '-f', `${getDockerConfigFolder()}/docker-compose.yml`, 'run', '--rm', getRunImage(), '/bin/bash', '-c', 'yarn seed'];

    verbose(`Docker command: ${composeCommand} ${spawnArgs.join(' ')}`);

    spawn(composeCommand, spawnArgs, { stdio: 'inherit' });
  }
}

module.exports = {
  SeedCommand,
};
