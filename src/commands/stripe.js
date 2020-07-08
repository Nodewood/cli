const chalk = require('chalk');
const stripe = require('stripe')(process.env.STRIPE_SK);
const { resolve } = require('path');
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { get, last, sortBy } = require('lodash');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');

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
    this.localConfig = this.getLocalConfig();
    this.remoteConfig = await this.getRemoteConfig();

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
   * Build a list of Products and nested Prices from the local Nodewood configuration.
   *
   * Products and Prices are sorted by ID.
   *
   * @return {Object}
   */
  getLocalConfig() {
    try {
      let config = readJsonSync(resolve(process.cwd(), 'app/config/stripe.json'));
      config.products = sortBy(config.products, 'id').map((product) => {
        return {
          ...product,
          prices: sortBy(product.prices, 'id'),
        };
      });

      return config;
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.red(`Could not find '${chalk.cyan(resolve(process.cwd(), 'app/config/stripe.json'))}'.`));
      }
      else {
        console.log(chalk.red(error.message));
      }

      throw error;
    }
  }

  /**
   * Build a list of Products and nested Prices from the project's Stripe account.
   *
   * Products and Prices are sorted by ID.
   *
   * @return {Object}
   */
  async getRemoteConfig() {
    const stripeProductList = await this.getStripeProductList();
    const stripePriceList = await this.getStripePriceList();

    return {
      products: sortBy(stripeProductList, 'id').map((product) => {
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          metadata: product.metadata,
          prices: sortBy(stripePriceList, 'id')
            .filter((price) => price.product === product.id)
            .map((price) => {
              return {
                id: price.id,
                nickname: price.nickname,
                unit_amount: price.unit_amount,
                currency: price.currency,
                interval: price.recurring.interval,
                interval_count: price.recurring.interval_count,
                metadata: price.metadata,
              };
            }),
        };
      }),
    };
  }

  /**
   * Get the full, unaltered list of products from Stripe.
   *
   * @return {Array}
   */
  async getStripeProductList() {
    let productList = [];
    let params = {};
    let response;

    do {
      response = await stripe.products.list(params); // eslint-disable-line no-await-in-loop
      params.starting_after = get(last(response.data), 'id');

      productList = productList.concat(response.data);
    } while (response.has_more);

    return productList;
  }

  /**
   * Get the full, unaltered list of prices from Stripe.
   *
   * @return {Array}
   */
  async getStripePriceList() {
    let priceList = [];
    let params = {};
    let response;

    do {
      response = await stripe.prices.list(params); // eslint-disable-line no-await-in-loop
      params.starting_after = get(last(response.data), 'id');

      priceList = priceList.concat(response.data);
    } while (response.has_more);

    return priceList;
  }

  async diff() {
    console.log(this.localConfig);
    console.log(this.remoteConfig);


  }

  async sync() {
    console.log('sync');
  }

  async import() {
    writeJsonSync(
      resolve(process.cwd(), 'app/config/stripe.json'),
      this.remoteConfig,
      {
        spaces: 2,
      },
    );

    console.log(`${chalk.cyan(resolve(process.cwd(), 'app/config/stripe.json'))} has been created from existing Stripe configuration.`);
  }
}

module.exports = {
  StripeCommand,
};
