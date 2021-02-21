const { coerce, gt } = require('semver');
const { forEach, get } = require('lodash');
const { resolve } = require('path');
const { readJsonSync, writeJsonSync } = require('fs-extra');

/**
 * Updates `app/package.json` dependencies with versions from `wood/package.json`.
 */
function updateAppDependencies() {
  const appPackage = readJsonSync(resolve(process.cwd(), 'app/package.json'));
  const woodPackage = readJsonSync(resolve(process.cwd(), 'wood/package.json'));

  ['dependencies', 'devDependencies'].forEach((section) => {
    forEach(woodPackage[section], (woodSemVer, packageName) => {
      const appSemVer = get(appPackage[section], packageName, false);

      // If this dependency exists in app package
      if (appSemVer) {
        const appVersion = coerce(appSemVer, { loose: true });
        const woodVersion = coerce(woodSemVer, { loose: true });

        // Wood version is more-recent, update app package
        if (gt(woodVersion, appVersion)) {
          appPackage[section][packageName] = woodSemVer;
        }
      }
    });
  });

  writeJsonSync(
    resolve(process.cwd(), 'app/package.json'),
    appPackage,
    { spaces: 2 },
  );
}

module.exports = {
  updateAppDependencies,
};
