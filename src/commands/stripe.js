const chalk = require('chalk');
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

  /**
   * Display difference between local configuration and remote configuration.
   */
  async diff() {
    console.log('Difference between your local config and existing Stripe config:\n');

    const differences = calculateDifferences(this.localConfig, this.remoteConfig);

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
   */
  async sync() {
    console.log('sync');
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
