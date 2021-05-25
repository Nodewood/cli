const chalk = require('chalk');
const { Spinner } = require('clui');
const stripe = require('stripe')(process.env.STRIPE_SK);
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { get, last, sortBy, omit, omitBy, isNil, isEqual, flatMap, invert } = require('lodash');
const { resolve } = require('path');
const { IncrementableProgress } = require('./ui');

const ALLOWED_UPDATE_KEYS = {
  product: [
    'active',
    'metadata',
    'name',
    'description',
  ],
  price: [
    'active',
    'metadata',
    'nickname',
    'description',
  ],
  tax: [
    'active',
    'metadata',
    'display_name',
    'description',
    'jurisdiction',
  ],
  coupon: [
    'name',
    'metadata',
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
  // Can't require ahead of time, since this command only works from a project directory
  const { countries } = require(resolve(process.cwd(), 'wood/config/geography')); // eslint-disable-line global-require

  try {
    let config = {};

    const productsConfig = readJsonSync(resolve(process.cwd(), 'app/config/stripe/products.json'));
    config.products = sortBy(productsConfig, 'id').map((product) => {
      return {
        ...product,
        prices: sortBy(product.prices, 'id'),
      };
    });
    config.prices = flatMap(
      productsConfig,
      (product) => product.prices.map((price) => ({ product: product.id, ...price })),
    ).filter((price) => price.product);

    const taxesConfig = readJsonSync(resolve(process.cwd(), 'app/config/stripe/taxes.json'));
    config.taxes = Object.keys(get(taxesConfig, 'countries', {})).flatMap(
      (countryKey) => taxesConfig.countries[countryKey].map((taxConfig) => ({
        jurisdiction: countries[countryKey],
        ...taxConfig,
      })),
    ).concat(Object.keys(get(taxesConfig, 'states', {})).flatMap(
      (countryKey) => Object.keys(get(taxesConfig, `states[${countryKey}]`, {})).flatMap(
        (stateKey) => taxesConfig.states[countryKey][stateKey].map((taxConfig) => ({
          jurisdiction: `${stateKey}, ${countries[countryKey]}`,
          ...taxConfig,
        })),
      ),
    ));

    config.coupons = readJsonSync(resolve(process.cwd(), 'app/config/stripe/coupons.json'));

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
  // Can't require ahead of time, since this command only works from a project directory
  const { countries } = require(resolve(process.cwd(), 'wood/config/geography')); // eslint-disable-line global-require
  const keyedCountryNames = invert(countries);

  // Add prices to products
  config.prices.forEach((price) => {
    config.products.map((product) => {
      if (price.product === product.id) {
        product.prices = get(product, 'prices', []).concat([omit(price, 'product')]);
      }
      return product;
    });
  });

  // Write products
  writeJsonSync(
    resolve(process.cwd(), 'app/config/stripe/products.json'),
    config.products,
    { spaces: 2 },
  );

  // Build taxes format
  let newTaxes = { countries: {}, states: {} };
  config.taxes.forEach((tax) => {
    const jurisdiction = tax.jurisdiction.split(',').map((j) => j.trim());
    if (jurisdiction.length === 1) {
      const country = keyedCountryNames[jurisdiction[0]];
      newTaxes.countries[country] = get(newTaxes.countries, country, []);
      newTaxes.countries[country].push(omit(tax, 'jurisdiction'));
    }
    else {
      const state = jurisdiction[0];
      const country = keyedCountryNames[jurisdiction[1]];

      newTaxes.states[country] = get(newTaxes.states, country, {});
      newTaxes.states[country][state] = get(newTaxes.states[country], state, []);
      newTaxes.states[country][state].push(omit(tax, 'jurisdiction'));
    }
  });

  // Write taxes
  writeJsonSync(
    resolve(process.cwd(), 'app/config/stripe/taxes.json'),
    newTaxes,
    { spaces: 2 },
  );

  // Write coupons
  writeJsonSync(
    resolve(process.cwd(), 'app/config/stripe/coupons.json'),
    config.coupons,
    { spaces: 2 },
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
  loadingSpinner.start();

  const productList = await getStripeProductList();
  const priceList = await getStripePriceList();
  const taxList = await getStripeTaxList();
  const couponList = await getStripeCouponList();

  loadingSpinner.stop();

  return {
    products: sortBy(productList, 'id').map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      metadata: get(product, 'metadata', {}),
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
      metadata: get(price, 'metadata', {}),
    })),
    taxes: sortBy(taxList, 'id').map((tax) => ({
      id: tax.id,
      display_name: tax.display_name,
      description: tax.description,
      active: tax.active,
      inclusive: tax.inclusive,
      percentage: tax.percentage,
      metadata: get(tax, 'metadata', {}),
      jurisdiction: tax.jurisdiction,
    })),
    coupons: sortBy(couponList, 'id').map((coupon) => ({
      id: coupon.id,
      name: coupon.name,
      duration: coupon.duration,
      currency: coupon.currency,
      metadata: get(coupon, 'metadata', {}),
      amount_off: get(coupon, 'amount_off', null),
      duration_in_months: get(coupon, 'duration_in_months', null),
      percent_off: get(coupon, 'percent_off', null),
      max_redemptions: get(coupon, 'max_redemptions', null),
      redeem_by: get(coupon, 'redeem_by', null),
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
 * Get the full, unaltered list of taxes from Stripe.
 *
 * @return {Array}
 */
async function getStripeTaxList() {
  let taxList = [];
  let params = {};
  let response;

  do {
    response = await stripe.taxRates.list(params); // eslint-disable-line no-await-in-loop
    params.starting_after = get(last(response.data), 'id');

    taxList = taxList.concat(response.data);
  } while (response.has_more);

  return taxList.filter((tax) => tax.active);
}

/**
 * Get the full, unaltered list of coupons from Stripe.
 *
 * @return {Array}
 */
async function getStripeCouponList() {
  let couponList = [];
  let params = {};
  let response;

  do {
    response = await stripe.coupons.list(params); // eslint-disable-line no-await-in-loop
    params.starting_after = get(last(response.data), 'id');

    couponList = couponList.concat(response.data);
  } while (response.has_more);

  return couponList;
}

/**
 * Calculate the differences between the local config and the remote config.
 *
 * @return {Object}
 */
function calculateDifferences(localConfig, remoteConfig) {
  // When checking local products for updates, omit the prices field
  const localProductsForUpdateCheck = localConfig.products
    .filter(updateableEntries)
    .map((product) => omit(product, 'prices'));
  const updateablePrices = localConfig.prices.filter(updateableEntries);
  const updateableTaxes = localConfig.taxes.filter(updateableEntries);
  const updateableCoupons = localConfig.coupons.filter(updateableEntries);

  return {
    products: {
      new: getNewEntries(localConfig.products),
      updated: getUpdatedEntries(localProductsForUpdateCheck, remoteConfig.products, 'product'),
      deactivated: getDeactivatedEntries(localConfig.products, remoteConfig.products),
    },
    prices: {
      new: getNewEntries(localConfig.prices),
      updated: getUpdatedEntries(updateablePrices, remoteConfig.prices, 'price'),
      deactivated: getDeactivatedEntries(localConfig.prices, remoteConfig.prices),
    },
    taxes: {
      new: getNewEntries(localConfig.taxes),
      updated: getUpdatedEntries(updateableTaxes, remoteConfig.taxes, 'tax'),
      deactivated: getDeactivatedEntries(localConfig.taxes, remoteConfig.taxes),
    },
    coupons: {
      new: getNewCoupons(localConfig.coupons, remoteConfig.coupons),
      updated: getUpdatedEntries(updateableCoupons, remoteConfig.coupons, 'coupon'),
      deactivated: getDeletedCoupons(localConfig.coupons, remoteConfig.coupons),
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
 * Calculate new coupons.
 *
 * Coupons can have their ID set manually, so we can't rely on ID being set to determine if they
 * are new, we have to actually compare against remote coupon list.
 *
 * @param {Array<Object>} localCoupons - The local coupons to identify new entries from.
 * @param {Array<Object>} remoteCoupons - The list of remote coupons to compare to.
 *
 * @return {Array<Object}
 */
function getNewCoupons(localCoupons, remoteCoupons) {
  const remoteIds = remoteCoupons.map((coupon) => coupon.id);

  return localCoupons.filter((coupon) => ! remoteIds.includes(coupon.id));
}

/**
 * Gets a list of entries that exist locally and remotely that could potentially be updated.
 *
 * @param {Object} entry - The entry to check.
 *
 * @return {Boolean}
 */
function updateableEntries(entry) {
  return !! entry.id;
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

    // Print a warning for all keys attempting to be changed that cannot be
    differences.filter((key) => ! ALLOWED_UPDATE_KEYS[entryName].includes(key))
      .forEach((key) => {
        console.log(chalk.yellow(`Local ${entryName} '${chalk.cyan(localEntry.id)}' has a modified ${key}, which cannot be modified and will be ignored.`));
      });

    // Entity is updated only if any of the keys allowed to be updated are modified
    return differences.filter((key) => ALLOWED_UPDATE_KEYS[entryName].includes(key)).length > 0;
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
 * Calculate coupons to be deleted on Stripe.
 *
 * Coupons cannot be deactivated, only deleted, so we cannot check the "active" property.
 *
 * @param {Array<Object>} localCoupons - The local entries to be checked.
 * @param {Array<Object>} remoteCoupons - The remote entries to be checked against.
 *
 * @return {Array<Object>} - The entries to be deleted.
 */
function getDeletedCoupons(localCoupons, remoteCoupons) {
  return remoteCoupons.filter((remote) => {
    const localEntry = last(localCoupons.filter((local) => local.id === remote.id));

    return (! localEntry);
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
 * Gets the full name of a tax, including percentage.
 *
 * @param {Object} tax - The tax to get the full name for
 *
 * @return {String}
 */
function getTaxFullName(tax) {
  return `${chalk.cyan(tax.display_name)} (${chalk.cyan(`${tax.jurisdiction}`)}): ${chalk.cyan(`${tax.percentage}%`)}`;
}

/**
 * Gets the full name of a coupon, including amount.
 *
 * @param {Object} coupon - The coupon to get the full name for
 *
 * @return {String}
 */
function getCouponFullName(coupon) {
  let textOff;

  if (coupon.amount_off) {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: coupon.currency,
    }).format(coupon.amount_off / 100);
    textOff = chalk.cyan(`${formattedAmount} off`);
  }
  else {
    textOff = chalk.cyan(`${coupon.percent_off}% off`);
  }

  const textDuration = coupon.duration === 'repeating'
    ? `for ${coupon.duration_in_months} months`
    : coupon.duration;

  const couponName = coupon.name || coupon.id || 'Unnamed coupon';

  return `${chalk.cyan(couponName)} (${textOff}) ${chalk.cyan(textDuration)}`;
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
 * Convert a tax from our local config format to the format Stripe's API is expecting.
 *
 * @param {Object} tax - The tax in our local config format.
 *
 * @return {Object}
 */
function convertStripeTax(tax) {
  return tax;
}

/**
 * Convert a coupon from our local config format to the format Stripe's API is expecting.
 *
 * Omit null/empty/falsey values to avoid triggering Stripe validation errors.
 *
 * @param {Object} coupon - The coupon in our local config format.
 *
 * @return {Object}
 */
function convertStripeCoupon(coupon) {
  return omitBy(coupon, isNil);
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
  const taxDifferences = Object.keys(differences.taxes)
    .reduce((total, key) => total + differences.taxes[key].length, 0);
  const couponDifferences = Object.keys(differences.coupons)
    .reduce((total, key) => total + differences.coupons[key].length, 0);

  return productDifferences + newProductPriceDifferences + priceDifferences
    + taxDifferences + couponDifferences;
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
      nickname: price.nickanme,
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

  // New taxes
  for (const tax of differences.taxes.new) {
    await stripe.taxRates.create(convertStripeTax(tax));
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Updated taxes
  for (const tax of differences.taxes.updated) {
    await stripe.taxRates.update(tax.id, {
      active: tax.active,
      display_name: tax.display_name,
      metadata: tax.metadata,
      description: tax.description,
    });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Deactivated taxes
  for (const tax of differences.taxes.deactivated) {
    await stripe.taxRates.update(tax.id, { active: false });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // New coupons
  for (const coupon of differences.coupons.new) {
    await stripe.coupons.create(convertStripeCoupon(coupon));
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Updated coupons
  for (const coupon of differences.coupons.updated) {
    await stripe.coupons.update(coupon.id, {
      name: coupon.name,
      metadata: coupon.metadata,
    });
    changesProgressBar.increment({ label: 'Applying changes: ' });
  }

  // Deleted coupons
  for (const coupon of differences.coupons.deactivated) {
    await stripe.coupons.del(coupon.id);
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
  getTaxFullName,
  getCouponFullName,
  getEntityDifferences,
  countDifferences,
  applyChanges,
};
