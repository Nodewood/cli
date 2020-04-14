const chalk = require('chalk');
const pluralize = require('pluralize');
const klawSync = require('klaw-sync');
const { get, kebabCase, camelCase, snakeCase, upperFirst } = require('lodash');
const { resolve, extname } = require('path');
const { emptyDirSync, existsSync, copySync, readFileSync, writeFileSync } = require('fs-extra');
const { Command } = require('../lib/Command');

const NODEWOOD_PREFIX = 'nodewood-';

const TYPE_FEATURE = 'feature';
const TYPE_CONTROLLER = 'controller';
const TYPE_SERVICE = 'service';

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
    // --overwrite: overwrite feature folder with empty feature
    // add TYPE FEATURE NAME
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  execute(args) {
    const toAdd = get(args._, 1, false);
    const overwrite = get(args, 'overwrite', false);

    if (toAdd === TYPE_FEATURE) {
      const name = get(args._, 2, false);
      const examples = get(args, 'examples', true);

      this.addFeature(name, { examples, overwrite });
    }
    else {
      const feature = get(args._, 2, false);
      const name = get(args._, 3, false);

      if (toAdd === TYPE_CONTROLLER) {
        this.addController(feature, name, { overwrite });
      }
      if (toAdd === TYPE_SERVICE) {
        this.addService(feature, name, { overwrite });
      }
      else {
        console.log(chalk.red(`Invalid type to add: '${toAdd}'`));
      }
    }
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
   * @param {Boolean} overwrite - If we should overwrite any existing feature.
   */
  addFeature(name, { examples, overwrite }) {
    const names = this.getNames(name);
    const sourceDir = resolve(process.cwd(), 'wood/templates/feature');
    const targetDir = resolve(process.cwd(), `app/features/${names.kebabPluralName}`);

    if (name.substr(0, 9) === NODEWOOD_PREFIX) {
      console.log(chalk.red(`Feature cannot start with '${chalk.cyan(NODEWOOD_PREFIX)}'.`));
      console.log('This keeps future Nodewood features from interfering with yours.');
      return;
    }

    if (overwrite) {
      emptyDirSync(targetDir);
      console.log('Target directory being overwritten.');
    }
    // If not overwriting, ensure feature does not already exist
    else if (existsSync(targetDir)) {
      console.log(chalk.red(`The folder for feature '${chalk.cyan(names.kebabPluralName)}' already exists.`));
      console.log(`Please ensure the folder 'app/features/${chalk.cyan(names.kebabPluralName)}' does not exist.`);
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
    console.log(chalk.cyan(targetDir));
    console.log(`\nEnsure you add '${chalk.cyan(names.kebabPluralName)}' to the '${chalk.cyan('features')}' array in '${chalk.cyan('app/config/app.js')}'.`);
  }

  /**
   * Add a controller.
   *
   * @param {String} feature - The name of the feature to add the controller to.
   * @param {String} name - The name of the controller to add.
   * @param {Boolean} overwrite - If we should overwrite the controller.
   */
  addController(feature, name, { overwrite }) {
    const featureNames = this.getNames(feature);
    const controllerNames = this.getNames(name);

    const controllerSource = resolve(process.cwd(), 'wood/templates/controller/Controller.js');
    const controllerTarget = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/api/controllers/${controllerNames.pascalName}Controller.js`);

    const testSource = resolve(process.cwd(), 'wood/templates/controller/Controller.test.js');
    const testTarget = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/api/controllers/__tests__/${controllerNames.pascalName}Controller.test.js`);

    // Don't accidentally overwrite these files
    if (! overwrite) {
      if (existsSync(controllerTarget)) {
        console.log(chalk.red('The controller you are trying to create already exists.'));
        console.log(`Please ensure the file '${chalk.cyan(controllerTarget)}' does not exist or set the --overwrite option.`);
        return;
      }

      if (existsSync(testTarget)) {
        console.log(chalk.red('The controller test you are trying to create already exists.'));
        console.log(`Please ensure the file '${chalk.cyan(testTarget)}' does not exist or set the --overwrite option.`);
        return;
      }
    }

    copySync(controllerSource, controllerTarget);
    const controllerContents = readFileSync(controllerTarget, 'utf-8');
    writeFileSync(controllerTarget, this.templateString(controllerContents, controllerNames));

    copySync(testSource, testTarget);
    const testContents = readFileSync(testTarget, 'utf-8');
    writeFileSync(testTarget, this.templateString(testContents, controllerNames));

    console.log('Controller and tests created at:');
    console.log(chalk.cyan(controllerTarget));
    console.log(chalk.cyan(testTarget));
  }

  /**
   * Add a service.
   *
   * @param {String} feature - The name of the feature to add the service to.
   * @param {String} name - The name of the service to add.
   * @param {Boolean} overwrite - If we should overwrite the service.
   */
  addService(feature, name, { overwrite }) {
    const featureNames = this.getNames(feature);
    const serviceNames = this.getNames(name);

    const source = resolve(process.cwd(), 'wood/templates/service/Service.js');
    const target = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/api/services/${serviceNames.pascalName}Service.js`);

    // Don't accidentally overwrite the service
    if (! overwrite && existsSync(target)) {
      console.log(chalk.red('The service you are trying to create already exists.'));
      console.log(`Please ensure the file '${chalk.cyan(target)}' does not exist or set the --overwrite option.`);
      return;
    }

    copySync(source, target);
    const contents = readFileSync(target, 'utf-8');
    writeFileSync(target, this.templateString(contents, serviceNames));

    console.log('Service created at:');
    console.log(chalk.cyan(target));
  }
}

module.exports = {
  AddCommand,
};
