const chalk = require('chalk');
const { Spinner } = require('clui');
const stripe = require('stripe')(process.env.STRIPE_SK);
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { get, last, sortBy, omit, isEqual, flatMap } = require('lodash');
const { resolve } = require('path');
const { IncrementableProgress } = require('./ui');

const ALLOWED_UPDATE_KEYS = {
  product: [
    'active',
    'metadata',
    'nickname',
  ],
  price: [
    'active',
    'description',
    'metadata',
    'nickname',
  ],
};

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
  // Add prices to products
  config.prices.forEach((price) => {
    config.products.map((product) => {
      if (price.product === product.id) {
        product.prices = get(product, 'prices', []).concat([omit(price, 'product')]);
      }
      return product;
    });
  });

  // Remove prices
  delete config.prices;

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
      product: price.product,
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

  return productList.filter((product) => product.active);
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

  return priceList.filter((price) => price.active);
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
    const differences = Object.keys(localEntry)
      .filter((key) => ! isEqual(localEntry[key], remoteEntry[key]));

    differences.filter((key) => ! ALLOWED_UPDATE_KEYS[entryName].includes(key))
      .forEach((key) => {
        console.log(chalk.yellow(`Local ${entryName} '${chalk.cyan(localEntry.id)}' has an updated ${key}, which cannot be modified and will be ignored.`));
      });

    return differences.length > 0;
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
 * Convert a product from our local config format to the format Stripe's API is expecting.
 *
 * @param {Object} product - The product in our local config format.
 *
 * @return {Object}
 */
function convertStripeProduct(product) {
  return omit(product, 'prices');
}

/**
 * Convert a price from our local config format to the format Stripe's API is expecting.
 *
 * @param {Object} price - The price in our local config format.
 * @param {String} productId - The ID of the product this price belongs to.
 *
 * @return {Object}
 */
function convertStripePrice(price, productId) {
  return {
    product: productId,
    nickname: price.nickname,
    active: price.active,
    unit_amount: price.unit_amount,
    currency: price.currency,
    metadata: price.metadata,
    recurring: {
      interval: price.interval,
      interval_count: price.interval_count,
    },
  };
}

/**
 * Count the total differences in a difference object.
 *
 * @param {Object} differences - The difference object to count differences in.
 *
 * @return {Number}
 */
function countDifferences(differences) {
  const productDifferences = Object.keys(differences.products)
    .reduce((total, key) => total + differences.products[key].length, 0);
  const newProductPriceDifferences = differences.products.new
    .reduce((total, product) => total + product.prices.length, 0);
  const priceDifferences = Object.keys(differences.products)
    .reduce((total, key) => total + differences.prices[key].length, 0);

  return productDifferences + newProductPriceDifferences + priceDifferences;
}

/**
 * Applies the changes to the remote Stripe configuration.
 *
 * @param {Object} differences - The differences to apply.
 */
async function applyChanges(differences) {
  // For simplicity's sake and error handling, we use for...of loops in this function,
  // which requires relaxing linting for a bit:
  /* eslint-disable no-restricted-syntax, no-await-in-loop */

  const totalDifferences = countDifferences(differences);
  const changesProgressBar = new IncrementableProgress(totalDifferences);
  changesProgressBar.display({ label: 'Applying changes: ' });

  // New products
  for (const product of differences.products.new) {
    const createdProduct = await stripe.products.create(convertStripeProduct(product));
    changesProgressBar.increment({ label: 'Applying changes: ' });

    await product.prices.forEach(async (price) => {
      await stripe.prices.create(convertStripePrice(price, createdProduct.id));
    });

    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Updated products
  for (const product of differences.products.updated) {
    await stripe.products.update(product.id, omit(product, 'id'));
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Deactivated products
  for (const product of differences.products.deactivated) {
    await stripe.products.update(product.id, { active: false });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // New prices
  for (const price of differences.prices.new) {
    await stripe.prices.create(convertStripePrice(price, price.product));
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Updated prices
  for (const price of differences.prices.updated) {
    await stripe.prices.update(price.id, {
      nickanme: price.nickanme,
      active: price.active,
      metadata: price.metadata,
    });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Deactivated prices
  for (const price of differences.prices.deactivated) {
    await stripe.prices.update(price.id, { active: false });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  /* eslint-enable no-restricted-syntax, no-await-in-loop */
}

module.exports = {
  getLocalConfig,
  writeLocalConfig,
  getRemoteConfig,
  calculateDifferences,
  getProductFullName,
  getPriceFullName,
  getEntityDifferences,
  countDifferences,
  applyChanges,
};
