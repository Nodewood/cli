const chalk = require('chalk');
const { resolve } = require('path');
const { get } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const {
  getLocalConfig,
  writeLocalConfig,
  getRemoteConfig,
  calculateDifferences,
} = require('../lib/stripe');

class StripeCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Manage Stripe Products and Prices.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood stripe diff    # Show the difference between your config and live plans');
    console.log('  nodewood stripe sync    # Update the live plans to match your config');
    console.log('  nodewood stripe import  # Imports current live plans as a Nodewood config');
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

    if (! get(process.env, 'STRIPE_SK')) {
      console.log(chalk.red('Stripe Secret Key (STRIPE_SK) is not SET in .env file.'));
      return;
    }

    // Load local and remote config for further processing
    this.localConfig = getLocalConfig();
    this.remoteConfig = await getRemoteConfig();

    const type = get(args._, 1);
    if (type === 'diff') {
      await this.diff();
    }
    else if (type === 'sync') {
      await this.sync();
    }
    else if (type === 'import') {
      await this.import();
    }
    else {
      console.log(chalk.red(`Invalid stripe command: '${type}'.`));
    }
  }

  async diff() {
    const differences = calculateDifferences(this.localConfig, this.remoteConfig);
    console.log(differences.prices);
  }

  async sync() {
    console.log('sync');
  }

  async import() {
    writeLocalConfig(this.remoteConfig);

    console.log(`${chalk.cyan(resolve(process.cwd(), 'app/config/stripe.json'))} has been created from existing Stripe configuration.`);
  }
}

module.exports = {
  StripeCommand,
};
