const chalk = require('chalk');
const moment = require('moment');
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
const { isNodewoodProject } = require('../lib/file');

const NODEWOOD_PREFIX = 'nodewood-';

const ROUTE_LINE = '      // DO NOT REMOVE: Generated routes will be added above this line';
const STORE_LINE = '    // DO NOT REMOVE: Generated stores will be added above this line';

const TYPE_FEATURE = 'feature';
const TYPE_CONTROLLER = 'controller';
const TYPE_SERVICE = 'service';
const TYPE_PAGE = 'page';
const TYPE_DIALOG = 'dialog';
const TYPE_STORE = 'store';
const TYPE_VALIDATOR = 'validator';
const TYPE_MODEL = 'model';
const TYPE_MIGRATION = 'migration';

const TEMPLATE_KEYS = {
  '###_SINGULAR_NAME_###': 'file.singularName', // api token
  '###_PLURAL_NAME_###': 'file.pluralName', // api tokens
  '###_CAMEL_NAME_###': 'file.camelName', // apiToken
  '###_PASCAL_NAME_###': 'file.pascalName', // ApiToken
  '###_KEBAB_NAME_###': 'file.kebabName', // api-token
  '###_SNAKE_NAME_###': 'file.snakeName', // api_token
  '###_CAMEL_PLURAL_NAME_###': 'file.camelPluralName', // apiTokens
  '###_PASCAL_PLURAL_NAME_###': 'file.pascalPluralName', // ApiTokens
  '###_KEBAB_PLURAL_NAME_###': 'file.kebabPluralName', // api-tokens
  '###_SNAKE_PLURAL_NAME_###': 'file.snakePluralName', // api_tokens

  '###_FEATURE_SINGULAR_NAME_###': 'feature.singularName',
  '###_FEATURE_PLURAL_NAME_###': 'feature.pluralName',
  '###_FEATURE_CAMEL_NAME_###': 'feature.camelName',
  '###_FEATURE_PASCAL_NAME_###': 'feature.pascalName',
  '###_FEATURE_KEBAB_NAME_###': 'feature.kebabName',
  '###_FEATURE_SNAKE_NAME_###': 'feature.snakeName',
  '###_FEATURE_CAMEL_PLURAL_NAME_###': 'feature.camelPluralName',
  '###_FEATURE_PASCAL_PLURAL_NAME_###': 'feature.pascalPluralName',
  '###_FEATURE_KEBAB_PLURAL_NAME_###': 'feature.kebabPluralName',
  '###_FEATURE_SNAKE_PLURAL_NAME_###': 'feature.snakePluralName',
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
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood add:TYPE FEATURE [NAME] [OPTIONS]');

    console.log(chalk.yellow('\nParameters:'));
    console.log(`  ${chalk.cyan('TYPE')}     # What to add to your app`);
    console.log(`           # Allowed: ${chalk.cyan('feature')}, ${chalk.cyan('controller')}, ${chalk.cyan('service')}, ${chalk.cyan('page')}, ${chalk.cyan('dialog')}, ${chalk.cyan('store')}, ${chalk.cyan('validator')}, ${chalk.cyan('model')}`);
    console.log(`  ${chalk.cyan('FEATURE')}  # The name of the feature to add, or the feature to add file to`);
    console.log(`  ${chalk.cyan('NAME')}     # The name of the file to add (optional)`);
    console.log(`  ${chalk.cyan('OPTIONS')}  # Options (see below)`);

    console.log(`\nNote: ${chalk.cyan('FEATURE')} and ${chalk.cyan('NAME')} must be kebab-case.`);

    console.log(chalk.yellow('\nOptions:'));
    console.log(`  ${chalk.cyan('--overwrite')}     # Overwrite existing files (does not apply to migrations)`);
    console.log(`  ${chalk.cyan('--no-examples')}   # Do not add controller, service, page, etc examples to new feature`);
    console.log(`  ${chalk.cyan('--no-init')}       # Do not modify init.js when adding page or store`);
    console.log(`  ${chalk.cyan('--plural=PLURAL')} # Use a custom plural`);

    console.log(chalk.yellow('\nExamples:'));
    console.log('  nodewood add:feature api-tokens --no-examples');
    console.log('  nodewood add:migration api-tokens');
    console.log('  nodewood add:dialog api-tokens edit-token --overwrite');
    console.log('  nodewood add:page api-tokens list-tokens --no-init');
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      console.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const toAdd = get(args._, 0, '').split(':')[1];

    const parsedArgs = {
      overwrite: get(args, 'overwrite', false),
      customPlural: get(args, 'plural', false),
      init: get(args, 'init', true),
    };

    if (toAdd === TYPE_FEATURE) {
      let name = get(args._, 1, false);

      if (! name) {
        console.log(chalk.red('You must enter a feature name.'));
        return;
      }

      name = pluralize(camelCase(name));

      this.addFeature(name, {
        ...parsedArgs,
        examples: get(args, 'examples', true),
      });
    }
    else if (toAdd === TYPE_MIGRATION) {
      const name = get(args._, 1, false);

      this.addMigration(name);
    }
    else {
      const feature = get(args._, 1, false);
      const name = get(args._, 2, false);

      if (! toAdd) {
        this.helpDetailed();
        return;
      }

      if (! existsSync(resolve((process.cwd(), `app/features/${feature}`)))) {
        console.log(chalk.red(`Feature '${feature}' does not exist at 'app/features/${feature}'.`));
        return;
      }

      if (toAdd === TYPE_CONTROLLER) {
        this.addController(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_SERVICE) {
        this.addService(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_PAGE) {
        this.addPage(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_DIALOG) {
        this.addDialog(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_STORE) {
        this.addStore(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_VALIDATOR) {
        this.addFormValidator(feature, name, parsedArgs);
      }
      else if (toAdd === TYPE_MODEL) {
        this.addModel(feature, name, parsedArgs);
      }
      else {
        console.log(chalk.red(`Invalid type to add: '${toAdd}'`));
      }
    }
  }

  /**
   * Get the various versions the provided name to be used when templating.
   *
   * @param {String} name - The name to get the modified names of.
   * @param {String} customPlural - A user-supplied plural to use, if any.
   *
   * @return {Object}
   */
  getNames(name, customPlural = false) {
    const singularName = pluralize(name.split('-').join(' '), 1);
    const pluralName = customPlural
      ? customPlural.split('-').join(' ')
      : pluralize(singularName, 2);

    return {
      singularName: singularName,
      pluralName: pluralName,

      camelName: camelCase(singularName),
      pascalName: upperFirst(camelCase(singularName)),
      kebabName: kebabCase(singularName),
      snakeName: snakeCase(singularName),

      camelPluralName: camelCase(pluralName),
      pascalPluralName: upperFirst(camelCase(pluralName)),
      kebabPluralName: kebabCase(pluralName),
      snakePluralName: snakeCase(pluralName),
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
  templateString(templateString, featureNames, fileNames) {
    const names = {
      feature: featureNames,
      file: fileNames,
    };

    return Object.entries(TEMPLATE_KEYS).reduce(
      (string, [key, value]) => string.replace(new RegExp(key, 'g'), get(names, value)),
      templateString,
    );
  }

  /**
   * Add a feature.
   *
   * @param {String} name - The name of the feature to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} examples - If we should add the examples to the feature.
   * @param {Boolean} overwrite - If we should overwrite any existing feature.
   */
  addFeature(name, { customPlural, examples, overwrite } = {}) {
    const featureNames = this.getNames(name, customPlural);

    const sourceDir = resolve(process.cwd(), 'wood/templates/feature');
    const targetDir = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}`);

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
      console.log(chalk.red(`The folder for feature '${chalk.cyan(featureNames.kebabPluralName)}' already exists.`));
      console.log(`Please ensure the folder 'app/features/${chalk.cyan(featureNames.kebabPluralName)}' does not exist.`);
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
      writeFileSync(file.path, this.templateString(contents, featureNames, featureNames));
    });

    console.log('Feature created at:');
    console.log(chalk.cyan(targetDir));

    if (examples) {
      this.addController(name, name, { customPlural: name, overwrite });
      this.addService(name, name, { customPlural: name, overwrite });
      this.addPage(name, name, { customPlural: name, overwrite, init: true });
      this.addDialog(name, name, { customPlural: name, overwrite });
      this.addStore(name, name, { customPlural: name, overwrite, init: true });
      this.addFormValidator(name, name, { customPlural: name, overwrite });
      this.addModel(name, name, { customPlural: name, overwrite });
      this.addMigration(name);
    }

    console.log(`\nTo enable your new feature, add '${chalk.cyan(featureNames.kebabPluralName)}' to the '${chalk.cyan('features')}' array in '${chalk.cyan('app/config/app.js')}'.`);
    console.log(`To add your feature to the sidebar, add an entry for it to the '${chalk.cyan('sidebar')}' array in '${chalk.cyan('app/config/app.js')}'.`);
  }

  /**
   * Adds a new migration.
   *
   * @param {String} name - The name of the migration to add.
   */
  addMigration(name) {
    const names = this.getNames(name);
    const ts = moment().format('YYYYMMDDHHmmss');
    const sourcePath = resolve(process.cwd(), 'wood/templates/migration/Migration.js');
    const targetPath = resolve(process.cwd(), `app/migrations/${ts}_${names.snakePluralName}.js`);

    const contents = readFileSync(sourcePath, 'utf-8');
    writeFileSync(
      targetPath,
      this.templateString(contents, names, names),
    );

    console.log('Migration created at:');
    console.log(chalk.cyan(targetPath));
    console.log(`\nAfter editing, make sure to run migrations with ${chalk.cyan('yarn migrate')} and restart your API server.`); // eslint-disable-line max-len
  }

  /**
   * Add a controller.
   *
   * @param {String} feature - The name of the feature to add the controller to.
   * @param {String} name - The name of the controller to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the controller.
   */
  addController(feature, name, { customPlural, overwrite } = {}) {
    const featureNames = this.getNames(feature, feature);
    const fileNames = this.getNames(name, customPlural);

    const controllerSource = resolve(process.cwd(), 'wood/templates/controller/Controller.js');
    const controllerTarget = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/api/controllers/${fileNames.pascalPluralName}Controller.js`);

    const testSource = resolve(process.cwd(), 'wood/templates/controller/Controller.test.js');
    const testTarget = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/api/controllers/__tests__/${fileNames.pascalPluralName}Controller.test.js`);

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
    writeFileSync(
      controllerTarget,
      this.templateString(controllerContents, featureNames, fileNames),
    );

    copySync(testSource, testTarget);
    const testContents = readFileSync(testTarget, 'utf-8');
    writeFileSync(
      testTarget,
      this.templateString(testContents, featureNames, fileNames),
    );

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
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the file.
   */
  addTemplateFile(sourceFile, targetTemplate, type, feature, name, customPlural, overwrite) {
    const featureNames = this.getNames(feature, feature);
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), sourceFile);
    const target = resolve(process.cwd(), template(targetTemplate)({
      featureName: featureNames.kebabPluralName,
      fileName: fileNames.pascalName,
      fileNamePlural: fileNames.pascalPluralName,
    }));

    // Don't accidentally overwrite the file
    if (! overwrite && existsSync(target)) {
      console.log(chalk.red(`The ${type} you are trying to create already exists.`));
      console.log(`Please ensure the file '${chalk.cyan(target)}' does not exist or set the --overwrite option.`);
      return;
    }

    copySync(source, target);
    const contents = readFileSync(target, 'utf-8');
    writeFileSync(target, this.templateString(contents, featureNames, fileNames));

    console.log(`${upperFirst(type)} created at:`);
    console.log(chalk.cyan(target));
  }

  /**
   * Delete a file.
   *
   * @param {String} feature - The feature to use in the filename template.
   * @param {String} name - The name to use in the filename template.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {String} fileTemplate - The filename template.
   */
  deleteFile(feature, name, customPlural, fileTemplate) {
    const featureNames = this.getNames(feature, feature);
    const fileNames = this.getNames(name, customPlural);

    const fileName = resolve(process.cwd(), template(fileTemplate)({
      featureName: featureNames.kebabPluralName,
      fileName: fileNames.pascalName,
    }));

    removeSync(fileName);
  }

  /**
   * Add a service.
   *
   * @param {String} feature - The name of the feature to add the service to.
   * @param {String} name - The name of the service to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the service.
   */
  addService(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/service/Service.js',
      'app/features/<%= featureName %>/api/services/<%= fileNamePlural %>Service.js',
      'service',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a page.
   *
   * @param {String} feature - The name of the feature to add the page to.
   * @param {String} name - The name of the page to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the page.
   * @param {Boolean} init - If we should create the route in the init.js as well.
   */
  addPage(feature, name, { customPlural, overwrite, init } = {}) {
    this.addTemplateFile(
      'wood/templates/page/Page.vue',
      'app/features/<%= featureName %>/ui/pages/<%= fileNamePlural %>Page.vue',
      'page',
      feature,
      name,
      customPlural,
      overwrite,
    );

    if (init && ! this.addRouteToInit(feature, name, customPlural)) {
      this.deleteFile(
        feature,
        name,
        'app/features/<%= featureName %>/ui/pages/<%= fileNamePlural %>Page.vue',
      );
      console.log(chalk.red('Page removed.'));
    }
  }

  /**
   * Add the route for a page to a feature's init.js.
   *
   * @param {String} feature - The name of the feature to add the route to.
   * @param {String} name - The name of the page to add the route for.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   */
  addRouteToInit(feature, name, customPlural) {
    const featureNames = this.getNames(feature, feature);
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), 'wood/templates/fragments/route.js');
    const target = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/ui/init.js`);

    const routeFragment = this.templateString(
      readFileSync(source, 'utf-8'),
      featureNames,
      fileNames,
    );
    const initFile = readFileSync(target, 'utf-8');

    // Don't add route if it already exists
    if (initFile.includes(`path: '/${fileNames.kebabName}'`)) {
      console.log(chalk.red(`Path ${chalk.cyan(`/${fileNames.kebabName}`)} already exists in routes in ${chalk.cyan(`app/features/${featureNames.kebabPluralName}/ui/init.js`)}.`));
      console.log(chalk.red('Please remove this route and try your command again.'));
      return false;
    }

    writeFileSync(target, initFile.replace(ROUTE_LINE, `${routeFragment}\n${ROUTE_LINE}`));
    console.log(`Route for ${chalk.cyan(name)} added to init.js.`);

    return true;
  }

  /**
   * Add a dialog.
   *
   * @param {String} feature - The name of the feature to add the dialog to.
   * @param {String} name - The name of the dialog to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the dialog.
   */
  addDialog(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/dialog/Dialog.vue',
      'app/features/<%= featureName %>/ui/dialogs/<%= fileName %>Dialog.vue',
      'dialog',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a store.
   *
   * @param {String} feature - The name of the feature to add the store to.
   * @param {String} name - The name of the store to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the store.
   * @param {Boolean} init - If we should create the store in the init.js as well.
   */
  addStore(feature, name, { customPlural, overwrite, init } = {}) {
    this.addTemplateFile(
      'wood/templates/store/Store.js',
      'app/features/<%= featureName %>/ui/stores/<%= fileName %>Store.js',
      'store',
      feature,
      name,
      customPlural,
      overwrite,
    );

    if (init && ! this.addStoreToInit(feature, name, customPlural)) {
      this.deleteFile(
        feature,
        name,
        'app/features/<%= featureName %>/ui/stores/<%= fileName %>Store.js',
      );
      console.log(chalk.red('Store removed.'));
    }
  }

  /**
   * Add a store to a feature's init.js.
   *
   * @param {String} feature - The name of the feature to add the store to.
   * @param {String} name - The name of the store to add to the init.js.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   */
  addStoreToInit(feature, name, customPlural) {
    const featureNames = this.getNames(feature, feature);
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), 'wood/templates/fragments/store.js');
    const target = resolve(process.cwd(), `app/features/${featureNames.kebabPluralName}/ui/init.js`);

    const storeFragment = this.templateString(
      readFileSync(source, 'utf-8'),
      featureNames,
      fileNames,
    );
    const initFile = readFileSync(target, 'utf-8');

    // Don't add route if it already exists
    if (initFile.includes(`'#features/${featureNames.kebabName}/ui/stores/${fileNames.pascalPluralName}Store'`)) {
      console.log(chalk.red(`Store ${chalk.cyan(`${fileNames.pascalPluralName}Store`)} already exists in ${chalk.cyan(`app/features/${featureNames.kebabPluralName}/ui/init.js`)}.`));
      console.log(chalk.red('Please remove this store and try your command again.'));
      return false;
    }

    writeFileSync(target, initFile.replace(STORE_LINE, `${storeFragment}\n${STORE_LINE}`));
    console.log(`Store for ${chalk.cyan(name)} added to init.js.`);

    return true;
  }

  /**
   * Add a validator.
   *
   * @param {String} feature - The name of the feature to add the validator to.
   * @param {String} name - The name of the validator to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the validator.
   */
  addFormValidator(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/validator/Validator.js',
      'app/features/<%= featureName %>/lib/validators/<%= fileName %>Validator.js',
      'validator',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a model.
   *
   * @param {String} feature - The name of the feature to add the model to.
   * @param {String} name - The name of the model to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the model.
   */
  addModel(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/model/Model.js',
      'app/features/<%= featureName %>/lib/models/<%= fileName %>Model.js',
      'model',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }
}

module.exports = {
  AddCommand,
};
