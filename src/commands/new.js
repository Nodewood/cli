const chalk = require('chalk');
const request = require('superagent');
const { get } = require('lodash');
const { resolve } = require('path');
const { prompt } = require('inquirer');
const {
  readdirSync,
  emptyDirSync,
  existsSync,
  lstatSync,
  writeJsonSync,
  createWriteStream,
} = require('fs-extra');
const { Command } = require('../lib/Command');
const { hmac } = require('../lib/hmac');

const URL_BASE = `https://${process.env.NODEWOOD_DOMAIN || 'nodewood.com'}/app/projects`;
const URL_SUFFIX_TEMPLATE = '/template';
const URL_SUFFIX_WOOD = '/wood';

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
    const path = resolve(process.cwd(), get(args._, 1, false));

    if (! overwrite && ! this.isEmptyDirectory(path)) {
      console.log(chalk.red(`Directory '${path}' must be empty.`));
      return;
    }

    emptyDirSync(path);

    const { apiKey, secretKey } = await this.getApiKeys();

    await this.writeTemplate(path, apiKey, secretKey);
    await this.writeWood(path, apiKey, secretKey);

    writeJsonSync(
      resolve(path, '.nodewood.js'),
      { apiKey, secretKey },
      { spaces: 2 },
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

    return prompt(questions);
  }

  /**
   * Fetch the latest template from the Nodewood server and write it to the provided path.
   *
   * @param {String} path - The path to write the template to.
   * @param {String} apiKey - The API key to pass to the Nodewood server.
   * @param {String} secretKey - The Secret key to generate an HMAC hash with.
   */
  async writeTemplate(path, apiKey, secretKey) {
    const writeStream = createWriteStream(`${path}/template.zip`);
    await request
      .get(`${URL_BASE}${URL_SUFFIX_TEMPLATE}`)
      .set('api-key', apiKey)
      .set('hmac-hash', hmac({ apiKey }, secretKey))
      .pipe(writeStream);

    console.log('write template');
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
