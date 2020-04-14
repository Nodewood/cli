const chalk = require('chalk');
const pluralize = require('pluralize');
const klawSync = require('klaw-sync');
const {
  get,
  kebabCase,
  camelCase,
  snakeCase,
  upperFirst,
  template,
} = require('lodash');
const { resolve, extname } = require('path');
const {
  emptyDirSync,
  removeSync,
  existsSync,
  copySync,
  readFileSync,
  writeFileSync,
} = require('fs-extra');
const { Command } = require('../lib/Command');

const NODEWOOD_PREFIX = 'nodewood-';

const ROUTE_LINE = '      // DO NOT REMOVE: Generated routes will be added above this line';
const STORE_LINE = '      // DO NOT REMOVE: Generated stores will be added above this line';

const TYPE_FEATURE = 'feature';
const TYPE_CONTROLLER = 'controller';
const TYPE_SERVICE = 'service';
const TYPE_PAGE = 'page';

const TEMPLATE_KEYS = {
  '###_SINGULAR_NAME_###': 'file.singularName',
  '###_PLURAL_NAME_###': 'file.pluralName',
  '###_CAMEL_NAME_###': 'file.camelName',
  '###_PASCAL_NAME_###': 'file.pascalName',
  '###_KEBAB_NAME_###': 'file.kebabName',
  '###_SNAKE_NAME_###': 'file.snakeName',
  '###_CAMEL_PLURAL_NAME_###': 'file.camelPluralName',
  '###_PASCAL_PLURAL_NAME_###': 'file.pascalPluralName',
  '###_KEBAB_PLURAL_NAME_###': 'file.kebabPluralName',
  '###_SNAKE_PLURAL_NAME_###': 'file.snakePluralNameName',

  '###_FEATURE_SINGULAR_NAME_###': 'feature.singularName',
  '###_FEATURE_PLURAL_NAME_###': 'feature.pluralName',
  '###_FEATURE_CAMEL_NAME_###': 'feature.camelName',
  '###_FEATURE_PASCAL_NAME_###': 'feature.pascalName',
  '###_FEATURE_KEBAB_NAME_###': 'feature.kebabName',
  '###_FEATURE_SNAKE_NAME_###': 'feature.snakeName',
  '###_FEATURE_CAMEL_PLURAL_NAME_###': 'feature.camelPluralName',
  '###_FEATURE_PASCAL_PLURAL_NAME_###': 'feature.pascalPluralName',
  '###_FEATURE_KEBAB_PLURAL_NAME_###': 'feature.kebabPluralName',
  '###_FEATURE_SNAKE_PLURAL_NAME_###': 'feature.snakePluralNameName',
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
    // --no-route: do not create route in ui/init.js
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

      this.addFeature(name, examples, overwrite);
    }
    else {
      const feature = get(args._, 2, false);
      const name = get(args._, 3, false);

      if (toAdd === TYPE_CONTROLLER) {
        this.addController(feature, name, overwrite);
      }
      else if (toAdd === TYPE_SERVICE) {
        this.addService(feature, name, overwrite);
      }
      else if (toAdd === TYPE_PAGE) {
        this.addPage(feature, name, overwrite, get(args, 'route', true));
      }
      else {
        console.log(chalk.red(`Invalid type to add: '${toAdd}'`));
      }
    }
  }

  /**
   * Get the various versions the provided name to be used when templating.
   *
   * @param {String} feature - The name of the feature to get the modified names of.
   * @param {String} file - The name of the file to get the modified names of.
   *
   * @return {Object}
   */
  getNames(feature, file) {
    const singularFeatureName = pluralize(feature.split('-').join(' '), 1);
    const pluralFeatureName = pluralize(singularFeatureName, 2);
    const singularFileName = pluralize(file.split('-').join(' '), 1);
    const pluralFileName = pluralize(singularFileName, 2);

    return {
      feature: {
        singularName: singularFeatureName,
        pluralName: pluralFeatureName,

        camelName: camelCase(singularFeatureName),
        pascalName: upperFirst(camelCase(singularFeatureName)),
        kebabName: kebabCase(singularFeatureName),
        snakeName: snakeCase(singularFeatureName),

        camelPluralName: camelCase(pluralFeatureName),
        pascalPluralName: upperFirst(camelCase(pluralFeatureName)),
        kebabPluralName: kebabCase(pluralFeatureName),
        snakePluralNameName: snakeCase(pluralFeatureName),
      },
      file: {
        singularName: singularFileName,
        pluralName: pluralFileName,

        camelName: camelCase(singularFileName),
        pascalName: upperFirst(camelCase(singularFileName)),
        kebabName: kebabCase(singularFileName),
        snakeName: snakeCase(singularFileName),

        camelPluralName: camelCase(pluralFileName),
        pascalPluralName: upperFirst(camelCase(pluralFileName)),
        kebabPluralName: kebabCase(pluralFileName),
        snakePluralNameName: snakeCase(pluralFileName),
      },
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
  templateString(templateString, names) {
    return Object.entries(TEMPLATE_KEYS).reduce(
      (string, [key, value]) => string.replace(new RegExp(key, 'g'), get(names, value)),
      templateString,
    );
  }

  /**
   * Add a feature.
   *
   * @param {String} name - The name of the feature to add.
   * @param {Boolean} examples - If we should add the examples to the feature.
   * @param {Boolean} overwrite - If we should overwrite any existing feature.
   */
  addFeature(name, examples, overwrite) {
    const names = this.getNames(name, name);
    const sourceDir = resolve(process.cwd(), 'wood/templates/feature');
    const targetDir = resolve(process.cwd(), `app/features/${names.feature.kebabPluralName}`);

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
      console.log(chalk.red(`The folder for feature '${chalk.cyan(names.feature.kebabPluralName)}' already exists.`));
      console.log(`Please ensure the folder 'app/features/${chalk.cyan(names.feature.kebabPluralName)}' does not exist.`);
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
    console.log(`\nEnsure you add '${chalk.cyan(names.feature.kebabPluralName)}' to the '${chalk.cyan('features')}' array in '${chalk.cyan('app/config/app.js')}'.`);
  }

  /**
   * Add a controller.
   *
   * @param {String} feature - The name of the feature to add the controller to.
   * @param {String} name - The name of the controller to add.
   * @param {Boolean} overwrite - If we should overwrite the controller.
   */
  addController(feature, name, overwrite) {
    const names = this.getNames(feature, name);

    const controllerSource = resolve(process.cwd(), 'wood/templates/controller/Controller.js');
    const controllerTarget = resolve(process.cwd(), `app/features/${names.feature.kebabPluralName}/api/controllers/${names.file.pascalName}Controller.js`);

    const testSource = resolve(process.cwd(), 'wood/templates/controller/Controller.test.js');
    const testTarget = resolve(process.cwd(), `app/features/${names.feature.kebabPluralName}/api/controllers/__tests__/${names.file.pascalName}Controller.test.js`);

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
    writeFileSync(controllerTarget, this.templateString(controllerContents, names));

    copySync(testSource, testTarget);
    const testContents = readFileSync(testTarget, 'utf-8');
    writeFileSync(testTarget, this.templateString(testContents, names));

    console.log('Controller and tests created at:');
    console.log(chalk.cyan(controllerTarget));
    console.log(chalk.cyan(testTarget));
  }

  /**
   * Add a single template file.  Reduces common code.
   *
   * @param {String} sourceFile - The source of the template file.
   * @param {String} targetTemplate - A template describing the location of the target file.
   * @param {String} type - The type of the file being added.
   * @param {String} feature - The name of the feature to add the file to.
   * @param {String} name - The name of the file to add.
   * @param {Boolean} overwrite - If we should overwrite the file.
   */
  addTemplateFile(sourceFile, targetTemplate, type, feature, name, overwrite) {
    const names = this.getNames(feature, name);

    const source = resolve(process.cwd(), sourceFile);
    const target = resolve(process.cwd(), template(targetTemplate)({
      featureName: names.feature.kebabPluralName,
      fileName: names.file.pascalName,
    }));

    // Don't accidentally overwrite the file
    if (! overwrite && existsSync(target)) {
      console.log(chalk.red(`The ${type} you are trying to create already exists.`));
      console.log(`Please ensure the file '${chalk.cyan(target)}' does not exist or set the --overwrite option.`);
      return;
    }

    copySync(source, target);
    const contents = readFileSync(target, 'utf-8');
    writeFileSync(target, this.templateString(contents, names));

    console.log(`${upperFirst(type)} created at:`);
    console.log(chalk.cyan(target));
  }

  /**
   * Delete a file.
   *
   * @param {String} feature - The feature to use in the filename template.
   * @param {String} name - The name to use in the filename template.
   * @param {String} fileTemplate - The filename template.
   */
  deleteFile(feature, name, fileTemplate) {
    const names = this.getNames(feature, name);
    const fileName = resolve(process.cwd(), template(fileTemplate)({
      featureName: names.feature.kebabPluralName,
      fileName: names.file.pascalName,
    }));

    removeSync(fileName);
  }

  /**
   * Add the route for a page to a feature's init.js.
   *
   * @param {String} feature - The name of the feature to add the route to.
   * @param {String} name - The name of the page to add the route for.
   */
  addRoute(feature, name) {
    const names = this.getNames(feature, name);

    const source = resolve(process.cwd(), 'wood/templates/fragments/route.js');
    const target = resolve(process.cwd(), `app/features/${names.feature.kebabPluralName}/ui/init.js`);

    const routeFragment = this.templateString(readFileSync(source, 'utf-8'), names);
    const initFile = readFileSync(target, 'utf-8');

    // Don't add route if it already exists
    if (initFile.includes(`path: '/${names.file.kebabName}'`)) {
      console.log(chalk.red(`Path ${chalk.cyan(`/${names.file.kebabName}`)} already exists in routes in ${chalk.cyan(`app/features/${names.feature.kebabPluralName}/ui/init.js`)}.`));
      console.log(chalk.red('Please remove this route and try your command again.'));
      return false;
    }

    writeFileSync(target, initFile.replace(ROUTE_LINE, `${routeFragment}\n${ROUTE_LINE}`));

    return true;
  }

  /**
   * Add a service.
   *
   * @param {String} feature - The name of the feature to add the service to.
   * @param {String} name - The name of the service to add.
   * @param {Boolean} overwrite - If we should overwrite the service.
   */
  addService(feature, name, overwrite) {
    this.addTemplateFile(
      'wood/templates/service/Service.js',
      'app/features/<%= featureName %>/api/services/<%= fileName %>Service.js',
      'service',
      feature,
      name,
      overwrite,
    );
  }

  /**
   * Add a page.
   *
   * @param {String} feature - The name of the feature to add the page to.
   * @param {String} name - The name of the page to add.
   * @param {Boolean} overwrite - If we should overwrite the page.
   * @param {Boolean} route - If we should create the route as well.
   */
  addPage(feature, name, overwrite, route) {
    this.addTemplateFile(
      'wood/templates/page/Page.vue',
      'app/features/<%= featureName %>/ui/pages/<%= fileName %>Page.vue',
      'page',
      feature,
      name,
      overwrite,
    );

    if (route && ! this.addRoute(feature, name)) {
      this.deleteFile(
        feature,
        name,
        'app/features/<%= featureName %>/ui/pages/<%= fileName %>Page.vue',
      );
      console.log(chalk.red('Page removed.'));
    }
  }
}

module.exports = {
  AddCommand,
};
