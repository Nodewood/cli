const chalk = require('chalk');
const { spawn } = require('child_process');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');

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
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood test FILE');

    console.log(chalk.yellow('\nParameters:'));
    console.log(`  ${chalk.cyan('FILE')}  # (Optional) Specific test file to run, or all if omitted.`);
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

    // Hidden flag, if we should test wood folder
    const wood = get(args, 'wood', false) ? 'cd wood && ' : '';

    const file = get(args._, 1, '');
    spawn('sh', ['-c', `docker-compose run --rm api bash -c "${wood}yarn test ${file}"`], { stdio: 'inherit' });
  }
}

module.exports = {
  TestCommand,
};
