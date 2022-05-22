const chalk = require('chalk');
const moment = require('moment');
const klawSync = require('klaw-sync');
const {
  get,
  kebabCase,
  camelCase,
  snakeCase,
  upperFirst,
  template,
  words,
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
const { pluralize } = require('../lib/text');
const { Command } = require('../lib/Command');
const { isNodewoodProject } = require('../lib/file');
const { log } = require('../lib/log');

const NODEWOOD_PREFIX = 'nodewood-';

const ROUTE_LINE = '    // DO NOT REMOVE: Generated routes will be added above this line';
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
const TYPE_SCRIPT = 'script';

const TEMPLATE_KEYS = {
  '###_SINGULAR_NAME_###': 'file.singularName', // api token
  '###_PLURAL_NAME_###': 'file.pluralName', // api tokens
  '###_CAMEL_NAME_###': 'file.camelName', // apiToken
  '###_PASCAL_NAME_###': 'file.pascalName', // ApiToken
  '###_KEBAB_NAME_###': 'file.kebabName', // api-token
  '###_SNAKE_NAME_###': 'file.snakeName', // api_token
  '###_UC_NAME_###': 'file.ucName', // Api Token
  '###_CAMEL_PLURAL_NAME_###': 'file.camelPluralName', // apiTokens
  '###_PASCAL_PLURAL_NAME_###': 'file.pascalPluralName', // ApiTokens
  '###_KEBAB_PLURAL_NAME_###': 'file.kebabPluralName', // api-tokens
  '###_SNAKE_PLURAL_NAME_###': 'file.snakePluralName', // api_tokens
  '###_UC_PLURAL_NAME_###': 'file.ucPluralName', // Api Tokens
  '###_UPPER_SNAKE_NAME_###': 'file.upperSnakeName', // API_TOKEN
  '###_UPPER_SNAKE_PLURAL_NAME_###': 'file.upperSnakePluralName', // API_TOKENS

  '###_FEATURE_NAME_###': 'feature',
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
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood add:TYPE FEATURE [NAME] [OPTIONS]');

    log(chalk.yellow('\nParameters:'));
    log(`  ${chalk.cyan('TYPE')}     # What to add to your app`);
    log(`           # Allowed: ${chalk.cyan('feature')}, ${chalk.cyan('controller')}, ${chalk.cyan('service')}, ${chalk.cyan('page')}, ${chalk.cyan('dialog')}, ${chalk.cyan('store')}, ${chalk.cyan('validator')}, ${chalk.cyan('model')}`);
    log(`  ${chalk.cyan('FEATURE')}  # The name of the feature to add, or the feature to add file to`);
    log(`  ${chalk.cyan('NAME')}     # The name of the file to add (optional)`);
    log(`  ${chalk.cyan('OPTIONS')}  # Options (see below)`);

    log(`\nNote: ${chalk.cyan('FEATURE')} and ${chalk.cyan('NAME')} must be kebab-case.`);

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('--overwrite')}     # Overwrite existing files (does not apply to migrations)`);
    log(`  ${chalk.cyan('--no-examples')}   # Do not add controller, service, page, etc examples to new feature`);
    log(`  ${chalk.cyan('--no-init')}       # Do not modify init.js when adding page or store`);
    log(`  ${chalk.cyan('--plural=PLURAL')} # Use a custom plural`);

    log(chalk.yellow('\nExamples:'));
    log('  nodewood add:feature api-tokens --no-examples');
    log('  nodewood add:migration api-tokens');
    log('  nodewood add:dialog api-tokens edit-token --overwrite');
    log('  nodewood add:page api-tokens list-tokens --no-init');
    log('  nodewood add:script api-tokens refresh-tokens');
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
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
        log(chalk.red('You must enter a feature name.'));
        return;
      }

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

      if (! existsSync(resolve(process.cwd(), `app/features/${feature}`))) {
        log(chalk.red(`Feature '${feature}' does not exist at 'app/features/${feature}'.`));
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
      else if (toAdd === TYPE_SCRIPT) {
        this.addScript(feature, name, parsedArgs);
      }
      else {
        log(chalk.red(`Invalid type to add: '${toAdd}'`));
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
      ucName: words(singularName).map(upperFirst).join(' '),

      camelPluralName: camelCase(pluralName),
      pascalPluralName: upperFirst(camelCase(pluralName)),
      kebabPluralName: kebabCase(pluralName),
      snakePluralName: snakeCase(pluralName),
      ucPluralName: words(pluralName).map(upperFirst).join(' '),

      upperSnakeName: snakeCase(singularName).toUpperCase(),
      upperSnakePluralName: snakeCase(pluralName).toUpperCase(),
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
  templateString(templateString, feature, fileNames) {
    const names = { feature, file: fileNames };

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
    const plural = pluralize(camelCase(name));
    const fileNames = this.getNames(plural, customPlural);

    const sourceDir = resolve(process.cwd(), 'wood/templates/feature');
    const targetDir = resolve(process.cwd(), `app/features/${name}`);

    if (name.substr(0, 9) === NODEWOOD_PREFIX) {
      log(chalk.red(`Feature cannot start with '${chalk.cyan(NODEWOOD_PREFIX)}'.`));
      log('This keeps future Nodewood features from interfering with yours.');
      return;
    }

    if (overwrite) {
      emptyDirSync(targetDir);
      log('Target directory being overwritten.');
    }
    // If not overwriting, ensure feature does not already exist
    else if (existsSync(targetDir)) {
      log(chalk.red(`The folder for feature '${chalk.cyan(name)}' already exists.`));
      log(`Please ensure the folder 'app/features/${chalk.cyan(name)}' does not exist.`);
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
      writeFileSync(file.path, this.templateString(contents, name, fileNames));
    });

    log('Feature created at:');
    log(chalk.cyan(targetDir));

    if (examples) {
      log(`Name: ${name}`);
      log(`Plural: ${plural}`);

      this.addController(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addService(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addPage(name, plural, { customPlural: customPlural || plural, overwrite, init: true });
      this.addNewDialog(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addEditDialog(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addDeleteDialog(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addStore(name, plural, { customPlural: customPlural || plural, overwrite, init: true });
      this.addFormValidator(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addModel(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addScript(name, plural, { customPlural: customPlural || plural, overwrite });
      this.addMigration(customPlural || plural);
    }

    log(`\nTo enable your new feature, add '${chalk.cyan(name)}' to the '${chalk.cyan('features')}' array in '${chalk.cyan('app/config/app.js')}'.`);
    log(`To add your feature to the sidebar, add an entry for it to the '${chalk.cyan('sidebar')}' array in '${chalk.cyan('app/config/ui.js')}'.`);
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
    const targetPath = resolve(process.cwd(), `app/migrations/${ts}_${name}.js`);

    const contents = readFileSync(sourcePath, 'utf-8');
    writeFileSync(
      targetPath,
      this.templateString(contents, names, names),
    );

    log('Migration created at:');
    log(chalk.cyan(targetPath));
    log(`\nAfter editing, make sure to run migrations with ${chalk.cyan('nodewood migrate')} and restart your API server.`); // eslint-disable-line max-len
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
    const fileNames = this.getNames(name, customPlural);

    const controllerSource = resolve(process.cwd(), 'wood/templates/controller/Controller.js');
    const controllerTarget = resolve(process.cwd(), `app/features/${feature}/api/controllers/${fileNames.pascalPluralName}Controller.js`);

    const testSource = resolve(process.cwd(), 'wood/templates/controller/Controller.test.js');
    const testTarget = resolve(process.cwd(), `app/features/${feature}/api/controllers/__tests__/${fileNames.pascalPluralName}Controller.test.js`);

    // Don't accidentally overwrite these files
    if (! overwrite) {
      if (existsSync(controllerTarget)) {
        log(chalk.red('The controller you are trying to create already exists.'));
        log(`Please ensure the file '${chalk.cyan(controllerTarget)}' does not exist or set the --overwrite option.`);
        return;
      }

      if (existsSync(testTarget)) {
        log(chalk.red('The controller test you are trying to create already exists.'));
        log(`Please ensure the file '${chalk.cyan(testTarget)}' does not exist or set the --overwrite option.`);
        return;
      }
    }

    copySync(controllerSource, controllerTarget);
    const controllerContents = readFileSync(controllerTarget, 'utf-8');
    writeFileSync(
      controllerTarget,
      this.templateString(controllerContents, feature, fileNames),
    );

    copySync(testSource, testTarget);
    const testContents = readFileSync(testTarget, 'utf-8');
    writeFileSync(
      testTarget,
      this.templateString(testContents, feature, fileNames),
    );

    log('Controller and tests created at:');
    log(chalk.cyan(controllerTarget));
    log(chalk.cyan(testTarget));
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
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), sourceFile);
    const target = resolve(process.cwd(), template(targetTemplate)({
      fileName: fileNames.pascalName,
      fileNamePlural: fileNames.pascalPluralName,
    }));

    // Don't accidentally overwrite the file
    if (! overwrite && existsSync(target)) {
      log(chalk.red(`The ${type} you are trying to create already exists.`));
      log(`Please ensure the file '${chalk.cyan(target)}' does not exist or set the --overwrite option.`);
      return;
    }

    copySync(source, target);
    const contents = readFileSync(target, 'utf-8');
    writeFileSync(target, this.templateString(contents, feature, fileNames));

    log(`${upperFirst(type)} created at:`);
    log(chalk.cyan(target));
  }

  /**
   * Delete a file.
   *
   * @param {String} name - The name to use in the filename template.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {String} fileTemplate - The filename template.
   */
  deleteFile(name, customPlural, fileTemplate) {
    const fileNames = this.getNames(name, customPlural);

    const fileName = resolve(process.cwd(), template(fileTemplate)({
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
      `app/features/${feature}/api/services/<%= fileNamePlural %>Service.js`,
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
      `app/features/${feature}/ui/pages/<%= fileNamePlural %>Page.vue`,
      'page',
      feature,
      name,
      customPlural,
      overwrite,
    );

    if (init && ! this.addRouteToInit(feature, name, customPlural)) {
      this.deleteFile(name, `app/features/${feature}/ui/pages/<%= fileNamePlural %>Page.vue`);
      log(chalk.red('Page removed.'));
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
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), 'wood/templates/fragments/route.js');
    const target = resolve(process.cwd(), `app/features/${feature}/ui/init.js`);

    const routeFragment = this.templateString(
      readFileSync(source, 'utf-8'),
      feature,
      fileNames,
    );
    const initFile = readFileSync(target, 'utf-8');

    // Don't add route if it already exists
    if (initFile.includes(`path: '/${fileNames.kebabName}'`)) {
      log(chalk.red(`Path ${chalk.cyan(`/${fileNames.kebabName}`)} already exists in routes in ${chalk.cyan(`app/features/${feature}/ui/init.js`)}.`));
      log(chalk.red('Please remove this route and try your command again.'));
      return false;
    }

    writeFileSync(target, initFile.replace(ROUTE_LINE, `${routeFragment}\n${ROUTE_LINE}`));
    log(`Route for ${chalk.cyan(name)} added to init.js.`);

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
      `app/features/${feature}/ui/dialogs/<%= fileName %>Dialog.vue`,
      'dialog',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a "new" dialog.
   *
   * @param {String} feature - The name of the feature to add the dialog to.
   * @param {String} name - The name of the dialog to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the dialog.
   */
  addNewDialog(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/dialog/NewDialog.vue',
      `app/features/${feature}/ui/dialogs/New<%= fileName %>Dialog.vue`,
      'dialog',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add an "edit" dialog.
   *
   * @param {String} feature - The name of the feature to add the dialog to.
   * @param {String} name - The name of the dialog to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the dialog.
   */
  addEditDialog(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/dialog/EditDialog.vue',
      `app/features/${feature}/ui/dialogs/Edit<%= fileName %>Dialog.vue`,
      'dialog',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a "delete" dialog.
   *
   * @param {String} feature - The name of the feature to add the dialog to.
   * @param {String} name - The name of the dialog to add.
   * @param {String} customPlural - A user-provided custom plural (or false for none).
   * @param {Boolean} overwrite - If we should overwrite the dialog.
   */
  addDeleteDialog(feature, name, { customPlural, overwrite } = {}) {
    this.addTemplateFile(
      'wood/templates/dialog/DeleteDialog.vue',
      `app/features/${feature}/ui/dialogs/Delete<%= fileName %>Dialog.vue`,
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
      `app/features/${feature}/ui/stores/<%= fileNamePlural %>Store.js`,
      'store',
      feature,
      name,
      customPlural,
      overwrite,
    );

    if (init && ! this.addStoreToInit(feature, name, customPlural)) {
      this.deleteFile(name, `app/features/${feature}/ui/stores/<%= fileNamePlural %>Store.js`);
      log(chalk.red('Store removed.'));
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
    const fileNames = this.getNames(name, customPlural);

    const source = resolve(process.cwd(), 'wood/templates/fragments/store.js');
    const target = resolve(process.cwd(), `app/features/${feature}/ui/init.js`);

    const storeFragment = this.templateString(
      readFileSync(source, 'utf-8'),
      feature,
      fileNames,
    );
    const initFile = readFileSync(target, 'utf-8');

    // Don't add route if it already exists
    if (initFile.includes(`'#features/${feature}/ui/stores/${fileNames.pascalPluralName}Store'`)) {
      log(chalk.red(`Store ${chalk.cyan(`${fileNames.pascalPluralName}Store`)} already exists in ${chalk.cyan(`app/features/${feature}/ui/init.js`)}.`));
      log(chalk.red('Please remove this store and try your command again.'));
      return false;
    }

    writeFileSync(target, initFile.replace(STORE_LINE, `${storeFragment}\n${STORE_LINE}`));
    log(`Store for ${chalk.cyan(name)} added to init.js.`);

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
      `app/features/${feature}/lib/validators/<%= fileName %>Validator.js`,
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
      `app/features/${feature}/lib/models/<%= fileName %>Model.js`,
      'model',
      feature,
      name,
      customPlural,
      overwrite,
    );
  }

  /**
   * Add a script.
   *
   * @param {String} feature - The name of the feature to add the script to.
   * @param {String} name - The name of the script to add.
   * @param {Boolean} overwrite - If we should overwrite the script.
   */
  addScript(feature, name, { customPlural, overwrite }) {
    this.addTemplateFile(
      'wood/templates/script/Script.js',
      `app/features/${feature}/cli/scripts/<%= fileName %>Script.js`,
      'script',
      feature,
      name,
      customPlural,
      overwrite,
    );

    this.addTemplateFile(
      'wood/templates/script/Script.test.js',
      `app/features/${feature}/cli/scripts/__tests__/<%= fileName %>Script.test.js`,
      'script test',
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
