const chalk = require('chalk');
const spawn = require('cross-spawn');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');

class TestCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Runs application tests.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    this.log(this.helpLine());

    this.log(chalk.yellow('\nUsage:'));
    this.log('  nodewood test FILE');

    this.log(chalk.yellow('\nParameters:'));
    this.log(`  ${chalk.cyan('FILE')}  # (Optional) Specific test file to run, or all if omitted.`);

    this.log(chalk.yellow('\nOptions:'));
    this.log(`  ${chalk.cyan('-u')}    # Updates Jest snapshots.`);
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

    // Hidden flag, if we should test wood folder
    const wood = get(args, 'wood', false) ? 'cd wood && ' : '';

    // If we should update snapshots
    const update = get(args, 'u', false) ? '-u' : '';

    // What file we should be testing
    const file = get(args._, 1, '');

    spawn(composeCommand, [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'run', '--rm', 'api', 'bash', '-c', `yarn migrate-test && ${wood} yarn test ${file} ${update}`], { stdio: 'inherit' });
  }
}

module.exports = {
  TestCommand,
};
