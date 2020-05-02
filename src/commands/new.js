const chalk = require('chalk');
const superagent = require('superagent');
const moment = require('moment');
const unzipper = require('unzipper');
const { get } = require('lodash');
const { resolve: pathResolve } = require('path');
const { prompt } = require('inquirer');
const {
  readdirSync,
  emptyDirSync,
  existsSync,
  lstatSync,
  writeJsonSync,
  createWriteStream,
  createReadStream,
  remove,
} = require('fs-extra');
const { Command } = require('../lib/Command');
const { hmac } = require('../lib/hmac');

const URL_BASE = `https://${process.env.NODEWOOD_DOMAIN || 'nodewood.com'}/api/public`;
const URL_SUFFIX_TEMPLATE = '/templates/latest';
const URL_SUFFIX_WOOD = '/wood/latest';

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
    console.log('Intialize a new Nodewood project.');

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

    try {
      await this.writeTemplate(path, apiKey, secretKey);
      await this.writeWood(path, apiKey, secretKey);

      console.log('template the path with project name');

      writeJsonSync(
        pathResolve(path, '.nodewood.js'),
        { apiKey, secretKey },
        { spaces: 2 },
      );
    }
    catch (error) {
      if (get(error, 'response.body.errors')) {
        const errorMessage = error.response.body.errors
          .map((errorEntry) => errorEntry.title)
          .join('. ');

        console.log(chalk.red(`Error: ${errorMessage}`));
      }
      else {
        console.log(chalk.red(error.message));
      }
    }
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
   */
  async writeTemplate(path, apiKey, secretKey) {
    await this.downloadZip(
      `${URL_BASE}${URL_SUFFIX_TEMPLATE}`,
      `${path}/template.zip`,
      apiKey,
      secretKey,
    );

    await this.unzipZip(`${path}/template.zip`, path);
  }

  /**
   * Download a zip from the Nodewood server.
   *
   * @param {String} from - The URL to download from.
   * @param {String} to - The locaction to put the zip file.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret Key to generate an HMAC hash with.
   */
  async downloadZip(from, to, apiKey, secretKey) {
    const ts = moment().format();

    await new Promise((resolve, reject) => {
      const request = superagent
        .get(from)
        .set('api-key', apiKey)
        .set('ts', ts)
        .set('hmac-hash', hmac({ apiKey }, ts, secretKey));

      // If a custom domain has been set, no point in strictly checking SSL certs
      if (process.env.NODEWOOD_DOMAIN) {
        request.disableTLSCerts();
      }

      request.on('error', reject);

      request.on('response', (response) => {
        if (response.status === 200) {
          const writer = createWriteStream(to);
          writer.write(response.body);
          resolve();
        }
        else {
          request.abort();
        }
      });

      request.end();
    });
  }

  /**
   * Unzip a local zip file and deletes it.
   *
   * @param {String} from - The location of the zip file.
   * @param {String} to - Where to unzip to.
   */
  async unzipZip(from, to) {
    await createReadStream(from).pipe(unzipper.Extract({ path: to }));
    await remove(from);
  }

  /**
   * Fetch the latest `wood` directory from the Nodewood server and write it to the provided path.
   *
   * @param {String} path - The path to write the `wood` directory to.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret key to generate an HMAC hash with.
   */
  async writeWood(path, apiKey, secretKey) {
    console.log('write wood');
  }
}

module.exports = {
  NewCommand,
};
