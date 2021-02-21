const chalk = require('chalk');
const { resolve, basename, extname } = require('path');
const { existsSync, chmodSync, readFileSync, writeFileSync } = require('fs-extra');
const { execSync } = require('child_process');
const { first, uniq, compact } = require('lodash');
const { parse } = require('css');
const klawSync = require('klaw-sync');
const { IncrementableProgress } = require('../lib/ui');

/**
 * @type {Array} Scripts that need to have the execution bit set after unzipping.
 */
const scripts = [
  '/wood/docker/docker-postgresql-multiple-databases/create-multiple-postgresql-databases.sh',
];

/**
 * Confirms that the working folder is the root of a Nodewood project.
 *
 * @return {Boolean}
 */
function isNodewoodProject() {
  try {
    // ".nodewood.js" should exist in the root of all Nodewood projects
    require(resolve(process.cwd(), '.nodewood.js')); // eslint-disable-line global-require

    return true;
  }
  catch (error) {
    if (process.env.NODE_DEV === 'development') {
      console.log(error);
    }

    return false;
  }
}

/**
 * Gets the folder name of the current Nodewood project.
 *
 * @return {String}
 */
function getProjectName() {
  return basename(process.cwd());
}

/**
 * Fix the execution file mode of important scripts.
 *
 * @param {String} path - The path where the new project has been installed.
 */
function fixScriptsMode(path) {
  scripts.forEach((script) => chmodSync(`${path}${script}`, 0o775));
}

/**
 * Gets the list of Tailwind classes to add the prefix to.
 *
 * @return {Array<String>}
 */
function getTailwindClassList() {
  const cssFile = resolve((process.cwd(), 'node_modules/tailwindcss/dist/tailwind.css'));

  if (! existsSync(cssFile)) {
    console.log(chalk.red(`Compiled ${chalk.cyan('tailwind.css')} file does not exist.`));
    console.log(chalk.red(`Please ensure you have successfully run ${chalk.cyan('nodewood dev')} at least once.`));

    throw new Error('Compiled tailwind.css file does not exist.');
  }

  const css = readFileSync(cssFile, 'utf8');

  const classRegex = new RegExp('\\.([\\w\\d-]+)');

  return compact(uniq(parse(css).stylesheet.rules.map((rule) => {
    const result = classRegex.exec(first(rule.selectors));
    return result ? result[1] : false;
  })));
}

/**
 * Update tailwind classes for all files in path.
 *
 * @param {String} path - The path to update files within.
 * @param {String} prefix - The prefix to prepend to classes.
 * @param {Array<String>} classList - The list of classes to prepend the prefix to.
 */
function updateTailwindClasses(path, prefix, classList) {
  const files = klawSync(path, {
    nodir: true,
    traverseAll: true,
    filter: ({ path: file }) => extname(file) === '.vue',
  });

  const progressBar = new IncrementableProgress(files.length);
  progressBar.display({ label: `Updating ${basename(path)} files: ` });

  files.forEach((file) => {
    progressBar.increment({ label: `Updating ${basename(path)} files: ` });

    let contents = readFileSync(file.path, 'utf-8');

    classList.forEach((tailwindClass) => {
      // Only prefix a class if it starts with a quote or space, so we don't re-prefix
      // classes that share names with other classes (mt-4 and -mt-4, for example).
      // This also makes this command reasonably safe to run multiple times.
      contents = contents.replaceAll(`"${tailwindClass}`, `"${prefix}${tailwindClass}`);
      contents = contents.replaceAll(` ${tailwindClass}`, ` ${prefix}${tailwindClass}`);
    });

    writeFileSync(file.path, contents);
  });
}

/**
 * Install node modules.
 *
 * @param {String} path - The project path to install node_modules for.
 */
function yarnInstall(path) {
  console.log('Installing node modules...');
  execSync('yarn install', {
    cwd: path,
    stdio: 'inherit',
  });
}


module.exports = {
  isNodewoodProject,
  getProjectName,
  fixScriptsMode,
  getTailwindClassList,
  updateTailwindClasses,
  yarnInstall,
};
