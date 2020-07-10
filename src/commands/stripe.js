const chalk = require('chalk');
const stripe = require('stripe')(process.env.STRIPE_SK);
const { resolve } = require('path');
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { get, last, sortBy, omit, isEqual, flatMap } = require('lodash');
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

    this.calculateDifferences();

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
      config.prices = flatMap(
        config.products,
        (product) => product.prices.map((price) => ({ product: product.id, ...price })),
      ).filter((price) => price.product);

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
    return {
      products: sortBy(await this.getStripeProductList(), 'id').map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        metadata: product.metadata,
      })),
      prices: sortBy(await this.getStripePriceList(), 'id').map((price) => ({
        id: price.id,
        nickname: price.nickname,
        active: price.active,
        unit_amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring.interval,
        interval_count: price.recurring.interval_count,
        metadata: price.metadata,
      })),
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

  /**
   * Calculate the differences between the local config and the remote config.
   */
  calculateDifferences() {
    this.differences = {
      products: {
        new: this.getNewProductDifferences(),
        updated: this.getUpdatedProductDifferences(),
        deactivated: this.getDeactivatedProductDifferences(),
      },
      prices: {
        new: this.getNewPriceDifferences(),
        updated: this.getUpdatedPriceDifferences(),
        deactivated: this.getDeactivatedPriceDifferences(),
      },
    };
  }

  /**
   * Calculate the new products to be created on Stripe (& their prices).
   *
   * Any product in local configuration without an ID is new.
   *
   * @return {Array}
   */
  getNewProductDifferences() {
    return this.localConfig.products.filter((product) => ! get(product, 'id'));
  }

  /**
   * Calculate products to be updated on Stripe.
   *
   * @return {Array<Object>} - The ID of the products to be updated.
   */
  getUpdatedProductDifferences() {
    return this.localConfig.products.map((product) => omit(product, 'prices')).filter((product) => {
      if (! get(product, 'id')) {
        return false;
      }

      const remoteProduct = last(this.remoteConfig.products.filter(
        (remote) => remote.id === product.id,
      ));

      if (! remoteProduct) {
        console.log(chalk.yellow(`Local product '${chalk.cyan(product.name)}' has an ID but does not exist remotely.`));
        console.log(chalk.yellow('This could be because you deleted a product on Stripe, but not from your config.\n'));
        return false;
      }

      // Different if there is more than one difference between the keys
      return Object.keys(product)
        .filter((key) => ! isEqual(product[key], remoteProduct[key]))
        .length > 0;
    });
  }

  /**
   * Calculate products to be deactivated on Stripe.
   *
   * Any remote product that does not have a local product or whose local product isn't active
   * should be deactivated.
   *
   * @return {Array<Object>} - The ID of the products to be deactivated.
   */
  getDeactivatedProductDifferences() {
    return this.remoteConfig.products.filter((product) => {
      const localProduct = last(this.localConfig.products.filter(
        (local) => local.id === product.id,
      ));

      return (! localProduct || ! localProduct.active);
    });
  }

  /**
   * Calculate new prices for existing products to be created on Stripe.
   *
   * A new price is defined as a price without an ID in a local product that DOES have an ID.
   *
   * @return {Array<Object>}
   */
  getNewPriceDifferences() {
    return this.localConfig.prices.filter((price) => ! price.id);
  }

  /**
   * Calculate prices to be updated on Stripe.
   *
   * @return {Array<Object>}
   */
  getUpdatedPriceDifferences() {
    return this.localConfig.prices.filter((price) => price.id).filter((price) => {
      const remotePrice = last(this.remoteConfig.prices.filter((remote) => remote.id === price.id));

      if (! remotePrice) {
        console.log(chalk.yellow(`Local price '${chalk.cyan(price.id)}' has an ID but does not exist remotely.`));
        console.log(chalk.yellow('This could be because you deleted a price on Stripe, but not from your config.\n'));
        return false;
      }

      // Different if there is more than one difference between the keys
      return Object.keys(price)
        .filter((key) => ! isEqual(price[key], remotePrice[key]))
        .length > 0;
    });
  }

  /**
   * Calculate prices to be deactivated on Stripe.
   *
   * @return {Array}
   */
  getDeactivatedPriceDifferences() {
    return this.remoteConfig.prices.filter((price) => {
      const localPrice = last(this.localConfig.prices.filter(
        (local) => local.id === price.id,
      ));

      return (! localPrice || ! localPrice.active);
    });
  }

  async diff() {
    console.log(this.differences.prices);
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
