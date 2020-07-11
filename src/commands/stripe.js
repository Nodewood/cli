const chalk = require('chalk');
const { prompt } = require('inquirer');
const { resolve } = require('path');
const { get, omit } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const {
  getLocalConfig,
  writeLocalConfig,
  getRemoteConfig,
  calculateDifferences,
  getProductFullName,
  getPriceFullName,
  getEntityDifferences,
  countDifferences,
  applyChanges,
} = require('../lib/stripe');

/**
 * Confirm if the user wants to apply changes.
 *
 * @return {boolean}
 */
async function confirmChanges() {
  const answers = await prompt({
    name: 'confirm',
    type: 'confirm',
    message: '\nDo you wish to upgrade apply these changes?',
  });

  return answers.confirm;
}

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

    console.log(chalk.yellow('\nOptions:'));
    console.log(`  ${chalk.cyan('--no-confirm')}     # Do not confirm before syncing`);
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
      await this.sync({ confirm: get(args, 'confirm', true) });
    }
    else if (type === 'import') {
      await this.import();
    }
    else {
      console.log(chalk.red(`Invalid stripe command: '${type}'.`));
    }
  }

  /**
   * Display difference between local configuration and remote configuration.
   *
   * @param {String} preamble - Text to display before showing changes.
   */
  async diff(preamble = 'Differences between your local config and existing Stripe config:\n') {
    const differences = calculateDifferences(this.localConfig, this.remoteConfig);
    if (countDifferences(differences) === 0) {
      console.log('No differences between your local config and existing Stripe config.');
      return;
    }

    console.log(preamble);

    // New products
    differences.products.new.forEach((product) => {
      console.log(chalk.green(`New product: ${getProductFullName(product)}`));
      product.prices.forEach((price) => {
        console.log(chalk.green(`  New price: ${getPriceFullName(price)}`));
      });
    });

    // Updated products
    differences.products.updated.forEach((product) => {
      console.log(chalk.green(`Updated product: ${getProductFullName(product)}`));

      getEntityDifferences(omit(product, 'prices'), this.remoteConfig.products)
        .forEach((difference) => {
          console.log(`  Changed ${difference.key}: '${chalk.red(difference.from)}' to '${chalk.green(difference.to)}'`);
        });
    });

    // Deactivated products
    differences.products.deactivated.forEach((product) => {
      console.log(chalk.red(`Deactivated product: ${getProductFullName(product)}`));
    });

    // New prices
    differences.prices.new.forEach((price) => {
      console.log(chalk.green(`New price: ${getPriceFullName(price)}`));
    });

    // Updated prices
    differences.prices.updated.forEach((price) => {
      console.log(chalk.green(`Updated price: ${getPriceFullName(price)}`));

      getEntityDifferences(omit(price, 'product'), this.remoteConfig.prices)
        .forEach((difference) => {
          console.log(`  Changed ${difference.key}: '${chalk.red(difference.from)}' to '${chalk.green(difference.to)}'`);
        });
    });

    // Deactivated prices
    differences.prices.deactivated.forEach((price) => {
      console.log(chalk.red(`Deactivated price: ${getPriceFullName(price)}`));
    });
  }

  /**
   * Ask user to confirm differences, then update remote configuration to match local one.
   *
   * @param {Boolean} confirm - If the user must first confirm changes.
   */
  async sync({ confirm }) {
    const differences = calculateDifferences(this.localConfig, this.remoteConfig);
    this.diff('The following changes will be applied to your Stripe configuration:\n');

    if (countDifferences(differences) === 0 || (confirm && ! await confirmChanges())) {
      return;
    }

    await applyChanges(differences);

    // Update local config to match new remote config
    writeLocalConfig(await getRemoteConfig());
  }

  /**
   * Import from remote configuration and write into local configuration.
   */
  async import() {
    writeLocalConfig(this.remoteConfig);

    console.log(`${chalk.cyan(resolve(process.cwd(), 'app/config/stripe.json'))} has been created from existing Stripe configuration.`);
  }
}

module.exports = {
  StripeCommand,
};
