const chalk = require('chalk');
const { spawn } = require('child_process');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');

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
    console.log('  nodewood migrate (ENV)');

    console.log(chalk.yellow('\nParameters:'));
    console.log(`  ${chalk.cyan('ENV')}     # Optionally ${chalk.cyan('test')} to run migrations against test database.`); // eslint-disable-line max-len
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  execute(args) {
    if (! isNodewoodProject()) {
      console.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const env = get(args._, 1, '') === 'test' ? '--env test' : '';
    const knexProcess = spawn('sh', ['-c', `knex migrate:latest ${env}`], { stdio: 'inherit' });
    knexProcess.on('close', (code) => {
      if (code > 0) {
        console.log(chalk.yellow('Are you running this command from the development VM or where your database resides?'));
      }
    });
  }
}

module.exports = {
  MigrateCommand,
};