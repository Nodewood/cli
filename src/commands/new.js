const chalk = require('chalk');
const klawSync = require('klaw-sync');
const spawn = require('cross-spawn');
const { get, kebabCase, snakeCase, compact } = require('lodash');
const { resolve: pathResolve, extname } = require('path');
const { prompt } = require('inquirer');
const {
  readdirSync,
  ensureDirSync,
  existsSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  copySync,
} = require('fs-extra');
const { Command } = require('../lib/Command');
const { yarnInstall } = require('../lib/file');
const {
  buildRequest,
  installTemplate,
  installWood,
  URL_BASE,
} = require('../lib/net');
const { log, verbose } = require('../lib/log');

const URL_SUFFIX_PROJECT_INFO = '/projects/'; // Requires :apiKey on the end

const TEMPLATE_KEYS = {
  '###_PROJECT_NAME_###': 'name',
  '###_KEBAB_PROJECT_NAME_###': 'kebabName',
  '###_SNAKE_PROJECT_NAME_###': 'snakeName',
};

const EXTENSIONS_TO_TEMPLATE = [
  '.js',
  '.json',
  '.yml',
  '.yaml',
  '.j2',
  '.template',
  '.html',
  '.test',
  '.md',
];

class NewCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Intialize a new Nodewood project.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    log(this.helpLine());

    log(chalk.yellow('\nUsage:'));
    log('  nodewood new DIR');

    log(chalk.yellow('\nOptions:'));
    log(`  ${chalk.cyan('--overwrite')}    # Overwrite existing files`);
    log(`  ${chalk.cyan('--skip-check')}   # Skip environment check`);
    log(`  ${chalk.cyan('-v')}             # Verbose output`);
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    const skipChecks = get(args, 'skip-check', false);
    if (! skipChecks && ! await this.areAllAppsInstalled()) {
      return;
    }

    const overwrite = get(args, 'overwrite', false);
    const pathArg = get(args._, 1, false);

    if (! pathArg) {
      this.helpDetailed();
      return;
    }

    const path = pathResolve(process.cwd(), pathArg);

    if (! overwrite && ! this.isEmptyDirectory(path)) {
      log(chalk.red(`Directory '${chalk.cyan(path)}' must be empty.`));
      log(`\nTo overwrite existing files, add the ${chalk.cyan('--overwrite')} option to your command.`);
      return;
    }

    ensureDirSync(path);

    const { apiKey, secretKey } = await this.getApiKeys();

    verbose(`Got API key:    '${apiKey.substr(0, 3)}...'`);
    verbose(`Got Secret key: '${secretKey.substr(0, 3)}...'`);

    const templateVersions = await installTemplate(path, apiKey, secretKey);
    const woodVersions = await installWood(path, apiKey, secretKey);
    const project = await this.getProjectDetails(apiKey, secretKey);

    await this.templateFiles(path, project, apiKey, secretKey);
    await this.writeConfigFile(path, { ...project, apiKey, secretKey });
    await this.copyEnvFile(path);
    yarnInstall(path);

    log('New project created at:');
    log(chalk.cyan(path));

    if (templateVersions.downloaded !== templateVersions.latest
      || woodVersions.downloaded !== woodVersions.latest) {
      const latest = woodVersions.downloaded !== woodVersions.latest
        ? woodVersions.latest
        : templateVersions.latest;
      const downloaded = woodVersions.downloaded !== woodVersions.latest
        ? woodVersions.downloaded
        : templateVersions.downloaded;

      log(chalk.yellow(`\nA later version of Nodewood (${latest}) is available than what your license allows you to download (${downloaded}).`)); // eslint-disable-line max-len
      log(chalk.yellow(`Log in to your account at ${chalk.cyan('https://nodewood.com')} and purchase an extension to your license to download the latest updates.`)); // eslint-disable-line max-len
    }

    log('\n To continue the installation, visit https://nodewood.com/docs/getting-started/installation/.');
  }

  /**
   * Get the project details from the Nodewood API by the API Key.
   *
   * @param {String} apiKey - The API Key to use to look up the project with.
   * @param {String} secretKey - The Secret Key to use to sign the request.
   *
   * @return {Object}
   */
  async getProjectDetails(apiKey, secretKey) {
    const response = await buildRequest(
      'GET',
      `${URL_BASE}${URL_SUFFIX_PROJECT_INFO}${apiKey}`,
      apiKey,
      secretKey,
    );

    return response.body.data;
  }

  /**
   * Write a configuration file in the new project's root.
   *
   * @param {String} path - The path to the root of the new project.
   * @param {Object} project - The project details to write for the configuration.
   */
  writeConfigFile(path, project) {
    writeFileSync(
      pathResolve(path, '.nodewood.js'),
      `module.exports = {\n  name: '${project.name}',\n  apiKey: '${project.apiKey}',\n  secretKey: '${project.secretKey}',\n};\n`, // eslint-disable-line max-len
    );
  }

  /**
   * Copy the initial .env.template file to .env to create initial environment file.
   *
   * @param {String} path - The project path to copy the environment file from/to.
   */
  copyEnvFile(path) {
    copySync(
      pathResolve(path, '.env.template'),
      pathResolve(path, '.env'),
    );
  }

  /**
   * Get the various versions the provided name to be used when templating.
   *
   * @param {String} name - The name to get the modified names of.
   *
   * @return {Object}
   */
  getNames(name) {
    return {
      name,
      kebabName: kebabCase(name),
      snakeName: snakeCase(name),
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
   * Checks if the provided path is an empty directory (or does not exist).
   *
   * @param {String} path - The path to check.
   *
   * @return {Boolean}
   */
  isEmptyDirectory(path) {
    if (! existsSync(path)) {
      return true;
    }

    if (lstatSync(path).isDirectory()) {
      return readdirSync(path).length === 0;
    }

    return false;
  }

  /**
   * Gets the API and Secret keys from the user.
   *
   * @return {apiKey, secretKey}
   */
  async getApiKeys() {
    const questions = [
      {
        name: 'apiKey',
        type: 'input',
        message: 'Enter the API Key for this project:',
        validate: (value) => {
          if (value.length) {
            return true;
          }

          return `Visit ${chalk.cyan('https://nodewood.com/app/projects')} for your API key.`;
        },
      },
      {
        name: 'secretKey',
        type: 'password',
        message: 'Enter the Secret Key for this project:',
        validate: (value) => {
          if (value.length) {
            return true;
          }

          return `Visit ${chalk.cyan('https://nodewood.com/app/projects')} for your secret key.`;
        },
      },
    ];

    const answers = await prompt(questions);

    return {
      apiKey: answers.apiKey.trim(),
      secretKey: answers.secretKey.trim(),
    };
  }

  /**
   * Template the downloaded files with the project details.
   *
   * @param {String} path - The path to find the files to template.
   * @param {Object} project - The project to template with.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret key to generate an HMAC hash with.
   */
  async templateFiles(path, project, apiKey, secretKey) {
    const names = this.getNames(project.name);

    const files = klawSync(path, {
      nodir: true,
      traverseAll: true,
      filter: this.shouldTemplateFile,
    });

    files.forEach((file) => {
      const contents = readFileSync(file.path, 'utf-8');
      writeFileSync(file.path, this.templateString(contents, names));
    });
  }

  /**
   * If the provided file should be templated.
   *
   * @param {Object} file - The file to decide if we should template.
   *
   * @return {boolean}
   */
  shouldTemplateFile(file) {
    return EXTENSIONS_TO_TEMPLATE.includes(extname(file.path));
  }

  /**
   * Ensure Vagrant, VirtualBox, Ansible, and Yarn are all installed.
   *
   * @return {boolean}
   */
  async areAllAppsInstalled() {
    const missingPrograms = compact(await Promise.all([
      this.canRun('docker-compose', ['--version'], 'Docker'),
      this.canRun('yarn', ['--version'], 'Yarn'),
    ]));

    if (missingPrograms.length) {
      log(chalk.red('Could not create new project, the following programs are not installed:'));
      missingPrograms.forEach((program) => log(`- ${chalk.cyan(program)}`));

      log(`\nTo skip this check, add the ${chalk.cyan('--skip-check')} option to your command.`);

      return false;
    }

    return true;
  }

  /**
   * Check if a program is installed by attempting to run a command.
   *
   * Returns either the name of the program if it couldn't be run, or null if it could.
   *
   * @param {String} command - The command to attempt to run.
   * @param {String} args - The args to pass to the command.
   * @param {String} program - The program we are checking for.
   *
   * @return {String|null}
   */
  async canRun(command, args, program) {
    return new Promise((resolve, reject) => {
      const cmdProcess = spawn(command, args, { stdio: 'ignore' });
      cmdProcess.on('close', (code) => {
        resolve(code > 0 ? program : null);
      });
      cmdProcess.on('error', (err) => resolve(program));
    });
  }
}

module.exports = {
  NewCommand,
};
