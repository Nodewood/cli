const chalk = require('chalk');
const { prompt } = require('inquirer');
const { resolve } = require('path');
const { get, omit, isPlainObject } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const {
  getLocalConfig,
  writeLocalConfig,
  getRemoteConfig,
  calculateDifferences,
  getProductFullName,
  getPriceFullName,
  getTaxFullName,
  getCouponFullName,
  getEntityDifferences,
  countDifferences,
  applyChanges,
} = require('../lib/stripe');
const { log } = require('../lib/log');

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

/**
 * Certain differences require formatting to be displayed correctly.
 *
 * @param {Mixed} difference - The difference to display.
 *
 * @return {String}
 */
function formatDifference(difference) {
  if (isPlainObject(difference)) {
    return JSON.stringify(difference);
  }

  return difference;
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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood stripe:diff    # Show the difference between your config and live plans');
    log('  nodewood stripe:sync    # Update the live plans to match your config');
    log('  nodewood stripe:import  # Imports current live plans as a Nodewood config');

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('--no-confirm')}     # Do not confirm before syncing`);
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

    if (! get(process.env, 'STRIPE_SK')) {
      log(chalk.red('Stripe Secret Key (STRIPE_SK) is not SET in .env file.'));
      return;
    }

    // Load local and remote config for further processing
    this.localConfig = getLocalConfig();
    this.remoteConfig = await getRemoteConfig();

    const type = get(args._, 0, '').split(':')[1];
    if (type === 'diff') {
      const differences = calculateDifferences(this.localConfig, this.remoteConfig);
      await this.diff(differences);
    }
    else if (type === 'sync') {
      const differences = calculateDifferences(this.localConfig, this.remoteConfig);
      await this.sync(differences, { confirm: get(args, 'confirm', true) });
    }
    else if (type === 'import') {
      await this.import();
    }
    else if (! type) {
      this.helpDetailed();
    }
    else {
      log(chalk.red(`Invalid stripe command: '${type}'.`));
    }
  }

  /**
   * Display difference between local configuration and remote configuration.
   *
   * @param {Object} differences - The differences to display.
   * @param {String} preamble - Text to display before showing changes.
   */
  async diff(
    differences,
    preamble = 'Differences between your local config and existing Stripe config:\n',
  ) {
    if (countDifferences(differences) === 0) {
      log('No differences between your local config and existing Stripe config.');
      return;
    }

    log(preamble);

    // New products
    differences.products.new.forEach((product) => {
      log(chalk.green(`New product: ${getProductFullName(product)}`));
      product.prices.forEach((price) => {
        log(chalk.green(`  New price: ${getPriceFullName(price)}`));
      });
    });

    // Updated products
    differences.products.updated.forEach((product) => {
      log(chalk.green(`Updated product: ${getProductFullName(product)}`));

      getEntityDifferences(omit(product, 'prices'), this.remoteConfig.products)
        .forEach((difference) => {
          log(`  Changed ${difference.key}: '${chalk.red(formatDifference(difference.from))}' to '${chalk.green(formatDifference(difference.to))}'`);
        });
    });

    // Deactivated products
    differences.products.deactivated.forEach((product) => {
      log(chalk.red(`Deactivated product: ${getProductFullName(product)}`));
    });

    // New prices
    differences.prices.new.forEach((price) => {
      log(chalk.green(`New price: ${getPriceFullName(price)}`));
    });

    // Updated prices
    differences.prices.updated.forEach((price) => {
      log(chalk.green(`Updated price: ${getPriceFullName(price)}`));

      getEntityDifferences(omit(price, 'product'), this.remoteConfig.prices)
        .forEach((difference) => {
          log(`  Changed ${difference.key}: '${chalk.red(formatDifference(difference.from))}' to '${chalk.green(formatDifference(difference.to))}'`);
        });
    });

    // Deactivated prices
    differences.prices.deactivated.forEach((price) => {
      log(chalk.red(`Deactivated price: ${getPriceFullName(price)}`));
    });

    // New taxes
    differences.taxes.new.forEach((tax) => {
      log(chalk.green(`New tax: ${getTaxFullName(tax)}`));
    });

    // Updated taxes
    differences.taxes.updated.forEach((tax) => {
      log(chalk.green(`Updated tax: ${getTaxFullName(tax)}`));

      getEntityDifferences(tax, this.remoteConfig.taxes)
        .forEach((difference) => {
          log(`  Changed ${difference.key}: '${chalk.red(formatDifference(difference.from))}' to '${chalk.green(formatDifference(difference.to))}'`);
        });
    });

    // Deactivated taxes
    differences.taxes.deactivated.forEach((tax) => {
      log(chalk.red(`Deactivated tax: ${getTaxFullName(tax)}`));
    });

    // New coupons
    differences.coupons.new.forEach((tax) => {
      log(chalk.green(`New coupon: ${getCouponFullName(tax)}`));
    });

    // Updated coupons
    differences.coupons.updated.forEach((coupon) => {
      log(chalk.green(`Updated coupon: ${getCouponFullName(coupon)}`));

      getEntityDifferences(coupon, this.remoteConfig.coupons)
        .forEach((difference) => {
          log(`  Changed ${difference.key}: '${chalk.red(formatDifference(difference.from))}' to '${chalk.green(formatDifference(difference.to))}'`);
        });
    });

    // Deleted coupons
    differences.coupons.deactivated.forEach((coupon) => {
      log(chalk.red(`Deleted coupon: ${getCouponFullName(coupon)}`));
    });
  }

  /**
   * Ask user to confirm differences, then update remote configuration to match local one.
   *
   * @param {Object} differences - The differences to sync.
   * @param {Boolean} confirm - If the user must first confirm changes.
   */
  async sync(differences, { confirm }) {
    await this.diff(differences, 'The following changes will be applied to your Stripe configuration:\n');

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

    log(`${chalk.cyan(resolve(process.cwd(), 'app/config/stripe.json'))} has been created from existing Stripe configuration.`);
  }
}

module.exports = {
  StripeCommand,
};
