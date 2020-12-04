const chalk = require('chalk');
const { prompt } = require('inquirer');
const { resolve } = require('path');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const {
  isNodewoodProject,
  getTailwindClassList,
  updateTailwindClasses,
} = require('../lib/file');

class TailwindCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Makes changes to your tailwind configuration.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood tailwind:prefix  # Add a prefix to all tailwind classes.');
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

    const type = get(args._, 0, '').split(':')[1];
    if (type === 'prefix') {
      console.log(chalk.red('Please make sure you have committed all current changes to source control before you begin.'));

      const prefix = await this.getPrefix();
      const classList = getTailwindClassList();

      ['wood', 'app'].forEach(
        (folder) => updateTailwindClasses(resolve(process.cwd(), folder), prefix, classList),
      );

      console.log(chalk.yellow(`\nMake sure to update your ${chalk.cyan('app/tailwind.config.css')} with the following line:`));
      console.log(chalk.cyan(`  prefix: '${prefix}',`));
    }
    else {
      this.helpDetailed();
    }
  }

  /**
   * Get the prefix to prepend to the Tailwind classes.
   *
   * @return {String}
   */
  async getPrefix() {
    const answers = await prompt({
      name: 'prefix',
      type: 'input',
      message: 'Specify prefix for tailwind classes:',
    });

    if (answers.prefix.trim().length === 0) {
      throw new Error('You must specify a prefix.');
    }

    // Ensure prefix ends in a hyphen
    return answers.prefix.substr(-1) === '-' ? answers.prefix : `${answers.prefix}-`;
  }
}

module.exports = {
  TailwindCommand,
};
