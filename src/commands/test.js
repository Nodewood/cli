const chalk = require('chalk');
const spawn = require('cross-spawn');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder, getRunImage } = require('../lib/docker');
const { log, verbose } = require('../lib/log');

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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood test FILE');

    log(chalk.yellow('\nParameters:'));
    log(`  ${chalk.cyan('FILE')}  # (Optional) Specific test file to run, or all if omitted.`);

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('-u')}    # Updates Jest snapshots.`);
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

    // Hidden flag, if we should test wood folder
    const wood = get(args, 'wood', false) ? 'cd wood && ' : '';

    // If we should update snapshots
    const update = get(args, 'u', false) ? '-u' : '';

    // What file we should be testing
    const file = get(args._, 1, '');

    const spawnArgs = [...composeArgs, '-p', getProjectName(), '-f', `${getDockerConfigFolder()}/docker-compose.yml`, 'run', '--rm', getRunImage(), 'bash', '-c', `yarn migrate-test && ${wood} yarn test ${file} ${update}`];

    verbose(`Docker command: ${composeCommand} ${spawnArgs.join(' ')}`);

    spawn(composeCommand, spawnArgs, { stdio: 'inherit' });
  }
}

module.exports = {
  TestCommand,
};
