const sha256 = require('crypto-js/sha256');
const hmacSHA512 = require('crypto-js/hmac-sha512');
const Base64 = require('crypto-js/enc-base64');

/**
 * Create an HMAC hash for a JSON object.
 *
 * @param {Object} obj - The object to create a hash for.
 * @param {String} ts - The timestamp to include in the object.
 * @param {String} privateKey - The private key to hash with.
 *
 * @return {String}
 */
function hmac(obj, ts, privateKey) {
  const hashDigest = sha256(JSON.stringify({ ts, ...obj }));

  return Base64.stringify(hmacSHA512(hashDigest, privateKey));
}

module.exports = {
  hmac,
};
