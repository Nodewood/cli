const chalk = require('chalk');
const superagent = require('superagent');
const moment = require('moment');
const unzipper = require('unzipper');
const klawSync = require('klaw-sync');
const { get, kebabCase, snakeCase } = require('lodash');
const { resolve: pathResolve, extname, basename } = require('path');
const { prompt } = require('inquirer');
const {
  readdirSync,
  emptyDirSync,
  existsSync,
  lstatSync,
  createWriteStream,
  createReadStream,
  remove,
  readFileSync,
  writeFileSync,
  readJsonSync,
} = require('fs-extra');
const { Command } = require('../lib/Command');
const { hmac } = require('../lib/hmac');

const URL_BASE = `https://${process.env.NODEWOOD_DOMAIN || 'nodewood.com'}/api/public`;
const URL_SUFFIX_TEMPLATE = '/releases/templates/latest';
const URL_SUFFIX_WOOD = '/releases/wood/latest';
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

const BASENAMES_TO_EMPLATE = [
  'Vagrantfile',
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
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood new DIR');

    console.log(chalk.yellow('\nOptions:'));
    console.log(`  ${chalk.cyan('--overwrite')}    # Overwrite existing files`);
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    const overwrite = get(args, 'overwrite', false);
    const path = pathResolve(process.cwd(), get(args._, 1, false));

    if (! overwrite && ! this.isEmptyDirectory(path)) {
      console.log(chalk.red(`Directory '${path}' must be empty.`));
      return;
    }

    emptyDirSync(path);

    const { apiKey, secretKey } = await this.getApiKeys();

    const templateVersions = await this.installTemplate(path, apiKey, secretKey);
    const woodVersions = await this.installWood(path, apiKey, secretKey);
    const project = await this.getProjectDetails(apiKey, secretKey);

    await this.templateFiles(path, project, apiKey, secretKey);
    await this.writeConfigFile(path, { ...project, apiKey, secretKey });

    console.log('New project created at:');
    console.log(chalk.cyan(path));

    if (templateVersions.downloaded !== templateVersions.latest
      || woodVersions.downloaded !== woodVersions.latest) {
      const latest = woodVersions.downloaded !== woodVersions.latest
        ? woodVersions.latest
        : templateVersions.latest;
      const downloaded = woodVersions.downloaded !== woodVersions.latest
        ? woodVersions.downloaded
        : templateVersions.downloaded;

      console.log(chalk.yellow(`\nA later version of Nodewood (${latest}) is available than what your license allows you to download (${downloaded}).`)); // eslint-disable-line max-len
      console.log(chalk.yellow(`Log in to your account at ${chalk.cyan('https://nodewood.com')} and purchase an extension to your license to download the latest updates.`)); // eslint-disable-line max-len
    }
  }

  /**
   * Build a request that can be awaited or streamed.
   *
   * @param {String} url - The URL of the request.
   * @param {String} apiKey - The API Key to send with the request.
   * @param {String} secretKey - The Secret Key to use to sign the request.
   *
   * @return {Reequest}
   */
  buildRequest(url, apiKey, secretKey) {
    const packageObj = readJsonSync(pathResolve(__dirname, '../../package.json'));
    const ts = moment().format();
    const request = superagent
      .get(url)
      .set('api-key', apiKey)
      .set('ts', ts)
      .set('cli-version', packageObj.version)
      .set('hmac-hash', hmac({ apiKey }, ts, secretKey));

    // If a custom domain has been set, no point in strictly checking SSL certs
    if (process.env.NODEWOOD_DOMAIN) {
      request.disableTLSCerts();
    }

    return request;
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
    const response = await this.buildRequest(
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

          return `Visit ${chalk.cyan('https://nodewood.test/app/projects')} for your API key.`;
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

          return `Visit ${chalk.cyan('https://nodewood.test/app/projects')} for your secret key.`;
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
   * Fetch the latest template from the Nodewood server and write it to the provided path.
   *
   * @param {String} path - The path to write the template to.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret Key to generate an HMAC hash with.
   *
   * @return { downloaded, latest } The downloaded and latest-possible version of the template.
   */
  async installTemplate(path, apiKey, secretKey) {
    const versions = await this.downloadZip(
      `${URL_BASE}${URL_SUFFIX_TEMPLATE}`,
      `${path}/template.zip`,
      apiKey,
      secretKey,
    );

    await this.unzipZip(`${path}/template.zip`, path);

    return versions;
  }

  /**
   * Fetch the latest `wood` directory from the Nodewood server and write it to the provided path.
   *
   * @param {String} path - The path to write the `wood` directory to.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret key to generate an HMAC hash with.
   *
   * @return { downloaded, latest } The downloaded and latest-possible version of wood.
   */
  async installWood(path, apiKey, secretKey) {
    const versions = await this.downloadZip(
      `${URL_BASE}${URL_SUFFIX_WOOD}`,
      `${path}/wood.zip`,
      apiKey,
      secretKey,
    );

    await this.unzipZip(`${path}/wood.zip`, `${path}/wood`);

    return versions;
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
    return EXTENSIONS_TO_TEMPLATE.includes(extname(file.path))
      || BASENAMES_TO_EMPLATE.includes(basename(file.path));
  }

  /**
   * Download a zip from the Nodewood server.
   *
   * @param {String} from - The URL to download from.
   * @param {String} to - The locaction to put the zip file.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret Key to generate an HMAC hash with.
   *
   * @return { downloaded, latest } The downloaded and latest-possible version of the zip.
   */
  async downloadZip(from, to, apiKey, secretKey) {
    const versions = await new Promise((resolve, reject) => {
      const request = this.buildRequest(from, apiKey, secretKey);

      request.on('error', reject);

      request.on('response', (response) => {
        if (response.status === 200) {
          const writer = createWriteStream(to);
          writer.write(response.body);
          resolve({
            downloaded: response.headers['downloaded-version'],
            latest: response.headers['latest-version'],
          });
        }
        else {
          request.abort();
        }
      });

      request.end();
    });

    return versions;
  }

  /**
   * Unzip a local zip file and deletes it.
   *
   * @param {String} from - The location of the zip file.
   * @param {String} to - Where to unzip to.
   */
  async unzipZip(from, to) {
    await new Promise((resolve, reject) => {
      createReadStream(from)
        .pipe(unzipper.Extract({ path: to }))
        .on('finish', resolve)
        .on('error', reject);
    });

    await remove(from);
  }
}

module.exports = {
  NewCommand,
};
