const chalk = require('chalk');
const pluralize = require('pluralize');
const klawSync = require('klaw-sync');
const { get, kebabCase, camelCase, snakeCase, upperFirst } = require('lodash');
const { resolve, extname } = require('path');
const { existsSync, copySync, readFileSync, writeFileSync } = require('fs-extra');
const { Command } = require('../lib/Command');

const NODEWOOD_PREFIX = 'nodewood-';

const TYPE_FEATURE = 'feature';

const TEMPLATE_KEYS = {
  '###_SINGULAR_NAME_###': 'singularName',
  '###_PLURAL_NAME_###': 'pluralName',
  '###_CAMEL_NAME_###': 'camelName',
  '###_PASCAL_NAME_###': 'pascalName',
  '###_KEBAB_NAME_###': 'kebabName',
  '###_SNAKE_NAME_###': 'snakeName',
  '###_CAMEL_PLURAL_NAME_###': 'camelPluralName',
  '###_PASCAL_PLURAL_NAME_###': 'pascalPluralName',
  '###_KEBAB_PLURAL_NAME_###': 'kebabPluralName',
  '###_SNAKE_PLURAL_NAME_###': 'snakePluralNameName',
};

class AddCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Add a file or feature from a template.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log('Add detailed help');
    // add feature NAME
    // expecting plural kebab-case
    // e.g. add feature api-tokens
    // --no-examples: create feature without any examples in feature folder
    // add TYPE FEATURE NAME
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  execute(args) {
    const toAdd = get(args._, 1, false);
    if (toAdd === TYPE_FEATURE) {
      const name = get(args._, 2, false);
      this.addFeature(name, get(args, 'examples', true));
      return;
    }

    console.log(chalk.red(`Invalid type to add: '${toAdd}'`));
  }

  /**
   * Get the various versions the provided name to be used when templating.
   *
   * @param {String} name - The name to modify.
   *
   * @return {Object}
   */
  getNames(name) {
    const singularName = pluralize(name.split('-').join(' '), 1);
    const pluralName = pluralize(singularName, 2);

    return {
      singularName,
      pluralName,

      camelName: camelCase(singularName),
      pascalName: upperFirst(camelCase(singularName)),
      kebabName: kebabCase(singularName),
      snakeName: snakeCase(singularName),

      camelPluralName: camelCase(pluralName),
      pascalPluralName: upperFirst(camelCase(pluralName)),
      kebabPluralName: kebabCase(pluralName),
      snakePluralNameName: snakeCase(pluralName),
    };
  }

  /**
   * Takes a string and templates it with the provided names.
   *
   * @param {String} template - The string to template.
   * @param {Object} names - The names to replace with.
   *
   * @return {String}
   */
  templateString(template, names) {
    return Object.entries(TEMPLATE_KEYS).reduce(
      (string, [key, value]) => string.replace(new RegExp(key, 'g'), names[value]),
      template,
    );
  }

  /**
   * Add a feature.
   *
   * @param {String} name - The name of the feature to add.
   * @param {Boolean} examples - If we should add the examples to the feature.
   */
  addFeature(name, examples) {
    const names = this.getNames(name);
    const sourceDir = resolve(process.cwd(), 'wood/templates/feature');
    const targetDir = resolve(process.cwd(), `app/features/${names.kebabPluralName}`);

    if (name.substr(0, 9) === NODEWOOD_PREFIX) {
      console.log(chalk.red(`Feature cannot start with '${NODEWOOD_PREFIX}'.`));
      console.log('This keeps future Nodewood features from interfering with yours.');
      return;
    }

    if (existsSync(targetDir)) {
      console.log(chalk.red(`The folder for feature '${names.kebabPluralName}' already exists.`));
      console.log(`Please ensure the folder 'app/features/${names.kebabPluralName}' does not exist.`);
      return;
    }

    copySync(sourceDir, targetDir);

    const files = klawSync(targetDir, {
      nodir: true,
      traverseAll: true,
      filter: ({ path }) => extname(path) === '.js',
    });

    files.forEach((file) => {
      const contents = readFileSync(file.path, 'utf-8');
      writeFileSync(file.path, this.templateString(contents, names));
    });

    console.log('Feature created at:');
    console.log(chalk.yellow(targetDir));
  }
}

module.exports = {
  AddCommand,
};
