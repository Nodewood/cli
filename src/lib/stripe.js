const chalk = require('chalk');
const { Spinner } = require('clui');
const stripe = require('stripe')(process.env.STRIPE_SK);
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { get, last, sortBy, omit, isEqual, flatMap } = require('lodash');
const { resolve } = require('path');
const { IncrementableProgress } = require('./ui');

/**
 * Build a list of Products and nested Prices from the local Nodewood configuration.
 *
 * Products and Prices are sorted by ID.
 *
 * @return {Object}
 */
function getLocalConfig() {
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

function writeLocalConfig(config) {
  writeJsonSync(
    resolve(process.cwd(), 'app/config/stripe.json'),
    config,
    {
      spaces: 2,
    },
  );
}

/**
 * Build a list of Products and nested Prices from the project's Stripe account.
 *
 * Products and Prices are sorted by ID.
 *
 * @return {Object}
 */
async function getRemoteConfig() {
  const loadingSpinner = new Spinner('Loading remote configuration from Stripe...');

  let productList;
  let priceList;

  loadingSpinner.start();
  productList = await getStripeProductList();
  priceList = await getStripePriceList();
  loadingSpinner.stop();

  return {
    products: sortBy(productList, 'id').map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      metadata: product.metadata,
    })),
    prices: sortBy(priceList, 'id').map((price) => ({
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
async function getStripeProductList() {
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
async function getStripePriceList() {
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
 *
 * @return {Object}
 */
function calculateDifferences(localConfig, remoteConfig) {
  // When checking local products for updates, skip new products and omit the prices field
  const localProductsForUpdateCheck = localConfig.products
    .filter((product) => get(product, 'id'))
    .map((product) => omit(product, 'prices'));

  // When checking local prices for updates, skip new prices
  const localPricesForUpdateCheck = localConfig.prices.filter((price) => price.id);

  return {
    products: {
      new: getNewEntries(localConfig.products),
      updated: getUpdatedEntries(localProductsForUpdateCheck, remoteConfig.products, 'product'),
      deactivated: getDeactivatedEntries(localConfig.products, remoteConfig.products),
    },
    prices: {
      new: getNewEntries(localConfig.prices),
      updated: getUpdatedEntries(localPricesForUpdateCheck, remoteConfig.prices, 'price'),
      deactivated: getDeactivatedEntries(localConfig.prices, remoteConfig.prices),
    },
  };
}

/**
 * Calculate the new entries in a list.
 *
 * Any entry without an ID is new.
 *
 * @param {Array<Object>} entries - The entries to check.
 *
 * @return {Array}
 */
function getNewEntries(entries) {
  return entries.filter((entry) => ! get(entry, 'id'));
}

/**
 * Calculate updated entries in a list.
 *
 * @param {Array<Object>} localEntries - The local entries to compare.
 * @param {Array<Object>} remoteEntries - The remote entries to compare against.
 * @param {String} entryName - The name of the entry we're checking, for logging.
 *
 * @return {Array<Object>}
 */
function getUpdatedEntries(localEntries, remoteEntries, entryName) {
  return localEntries.filter((localEntry) => {
    const remoteEntry = last(remoteEntries.filter((remote) => remote.id === localEntry.id));

    if (! remoteEntry) {
      console.log(chalk.yellow(`Local ${entryName} '${chalk.cyan(localEntry.id)}' has an ID but does not exist remotely.`));
      console.log(chalk.yellow(`This could be because you deleted a ${entryName} on Stripe, but not from your config.\n`));
      return false;
    }

    // Different if there is more than one difference between the keys
    return Object.keys(localEntry)
      .filter((key) => ! isEqual(localEntry[key], remoteEntry[key]))
      .length > 0;
  });
}

/**
 * Calculate entries to be deactivated on Stripe.
 *
 * Any remote entry that does not have a local entry or whose local entry isn't active
 * should be deactivated.
 *
 * @param {Array<Object>} localEntries - The local entries to be checked.
 * @param {Array<Object>} remoteEntries - The remote entries to be checked against.
 *
 * @return {Array<Object>} - The entries to be deactivated.
 */
function getDeactivatedEntries(localEntries, remoteEntries) {
  return remoteEntries.filter((remote) => {
    const localEntry = last(localEntries.filter((local) => local.id === remote.id));

    return (! localEntry || ! localEntry.active);
  });
}

/**
 * Get the full name of a product, including its description.
 *
 * @param {Object} product - The product to get the full name for.
 *
 * @return {String}
 */
function getProductFullName(product) {
  return `${chalk.cyan(product.name)} - (${chalk.cyan(product.description || 'No description')})`;
}

/**
 * Gets the full name of a price, including its cost.
 *
 * @param {Object} price - The price to get the full name for.
 *
 * @return {String}
 */
function getPriceFullName(price) {
  const formattedUnitPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
  }).format(price.unit_amount / 100);
  const formattedInterval = price.interval_count > 1
    ? `every ${price.interval_count} ${price.interval}s`
    : `/ ${price.interval}`;

  const description = `${formattedUnitPrice} ${price.currency.toUpperCase()} ${formattedInterval}`;

  return `${chalk.cyan(price.nickname || 'No nickname')} - (${chalk.cyan(description)})`;
}

/**
 * Get the differences between an entity and its remote entity.
 *
 * @param {Object} entity - The entity to get the differences for.
 * @param {Array} remoteEntities - The remote entities to find the remote entity from.
 *
 * @return {Array<Object>}
 */
function getEntityDifferences(entity, remoteEntities) {
  const remoteEntity = last(remoteEntities.filter((remote) => remote.id === entity.id));
  let differences = [];

  Object.keys(entity).forEach((key) => {
    if (! isEqual(entity[key], remoteEntity[key])) {
      differences.push({
        key,
        from: remoteEntity[key],
        to: entity[key],
      });
    }
  });

  return differences;
}

/**
 * Applies the changes to the remote Stripe configuration.
 *
 * @param {Object} differences - The differences to apply.
 */
async function applyChanges(differences) {
  const productDifferences = Object.keys(differences.products)
    .reduce((total, key) => total + differences.products[key].length, 0);
  const newProductPriceDifferences = differences.products.new
    .reduce((total, product) => total + product.prices.length, 0);
  const priceDifferences = Object.keys(differences.products)
    .reduce((total, key) => total + differences.prices[key].length, 0);

  const totalDifferences = productDifferences + newProductPriceDifferences + priceDifferences;

  const changesProgressBar = new IncrementableProgress(totalDifferences);
  changesProgressBar.display({ label: 'Applying changes: ' });

  // New products
  await differences.products.new.forEach(async (product) => {
    // const createdProduct = await stripe.products.create(omit(product, 'prices'));
    changesProgressBar.increment({ label: 'Applying changes: ' });

    await product.prices.forEach(async (price) => {
      // await stripe.prices.create({
      //   product: createdProduct.id,
      //   nickname: price.nickname,
      //   active: price.active,
      //   unit_amount: price.unit_amount,
      //   currency: price.currency,
      //   metadata: price.metadata,
      //   recurring: {
      //     interval: price.interval,
      //     interval_count: price.interval_count,
      //   },
      // });
    });

    changesProgressBar.increment({ label: 'Applying changes: ' });
  });

  // Updated products
  // Deactivated products
  // New prices
  // Updated prices
  // Deactivated prices
}

module.exports = {
  getLocalConfig,
  writeLocalConfig,
  getRemoteConfig,
  calculateDifferences,
  getProductFullName,
  getPriceFullName,
  getEntityDifferences,
  applyChanges,
};
