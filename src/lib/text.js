const pluralizeFn = require('pluralize');

/**
 * Pluralize/singularize the provided word.
 *
 * @param {String} word - The word to pluralize/singularize.
 * @param {Number} count - How many of the word exist.
 * @param {Boolean} inclusive - Whether to prefix with the number (e.g. 3 ducks).
 *
 * @return {String}
 */
function pluralize(word, count, inclusive) {
  // Deal with custom cases first.

  // Admin is always singular, exclusive
  if (word === 'admin') {
    return 'admin';
  }

  return pluralizeFn(word, count, inclusive);
}

module.exports = {
  pluralize,
};
