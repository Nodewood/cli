#!/usr/bin/env node
require('dotenv').config();

const chalk = require('chalk');
const figlet = require('figlet');
const { gt } = require('semver');
const { get } = require('lodash');
const { existsSync, readJsonSync } = require('fs-extra');
const { resolve } = require('path');
const commands = require('../src/lib/commands');
const { showHelp, showDetailedHelp } = require('../src/lib/help');
const { log } = require('../src/lib/log');

const args = require('minimist')(process.argv.slice(2));
const command = get(args._, 0, '').split(':')[0];

const REQUIRED_NODE_VERSION = '12.0.0';

/**
 * Displays the CLI header including CLI version and local Nodewood library version (if applicable).
 */
function displayHeader() {
  log(chalk.yellow(figlet.textSync('Nodewood', { horizontalLayout: 'full' })));

  const packageObj = readJsonSync(resolve(__dirname, '../package.json'));
  log(`CLI Version ${packageObj.version}`);

  if (existsSync(resolve(process.cwd(), 'wood/package.json'))) {
    const nodewoodObj = readJsonSync(resolve(process.cwd(), 'wood/package.json'));
    log(`Library Version ${nodewoodObj.version}`);
  }

  log(''); // Final newline
}

/**
 * If the command sent to the CLI is a valid command that we know how to handle.
 *
 * @param {String} checkCommand - The command supplied to the CLI.
 * @param {Object} checkCommands - The commands we know how to handle.
 *
 * @return {Boolean}
 */
function isInvalidCommand(checkCommand, checkCommands) {
  const knownCommands = Object.keys(checkCommands).concat(['help']);
  return ! checkCommand || ! knownCommands.includes(checkCommand);
}

/**
 * If the user is looking for help for a command we do not know how to handle.
 *
 * @param {String} checkCommand - The command supplied to the CLI.
 * @param {Array} checkArgs - The arguments passed to the CLI.
 * @param {Object} checkCommands - The commands we know how to handle.
 *
 * @return {Boolean}
 */
function isInvalidHelpCommand(checkCommand, checkArgs, checkCommands) {
  const helpCommand = get(args._, 1, false);
  return checkCommand === 'help' && ! Object.keys(checkCommands).includes(helpCommand);
}

/**
 * Identify if the user's active Node version is too low.
 *
 * @return {Boolean}
 */
function isInvalidNodeVersion() {
  return ! gt(process.version, REQUIRED_NODE_VERSION);
}

(async () => {
  displayHeader();

  // Show invalid version help
  if (isInvalidNodeVersion()) {
    log(`Your version of Node.js ${chalk.red(`(${process.version})`)} is lower than the required version to run Nodewood ${chalk.green(`(${REQUIRED_NODE_VERSION})`)}.`);
    log('Please upgrade your version of Node.js');
  }
  // Display generic help
  else if (isInvalidCommand(command, commands) || isInvalidHelpCommand(command, args, commands)) {
    showHelp(commands);
  }
  // Display detailed help
  else if (command === 'help') {
    const helpCommand = get(args._, 1, false);
    showDetailedHelp(helpCommand, commands);
  }
  // Execute a command
  else {
    try {
      const instance = new commands[command](args);
      await instance.execute(args);
    }
    catch (error) {
      if (process.env.NODE_DEV === 'development') {
        log('Logging error in development mode:');
        log(error);
      }

      log(chalk.red(`Could not complete your command.  If this continues, please email ${chalk.cyan('admin@nodewood.com')} for assistance.\n`));

      if (get(error, 'response.body.errors')) {
        const errorMessage = error.response.body.errors
          .map((errorEntry) => errorEntry.title)
          .join('. ');

        log(`Error message: ${errorMessage}`);
      }
      else if (couldNotConnect(error)) {
        log('Could not connect to the Nodewood server.  It may be temporarily down for an update.');
      }
      else {
        log(`Error message: ${error.message}`);
      }
    }
  }
})();

/**
 * If the error in question indicates that we could not connect to the Nodewood server.
 *
 * @param {Error} error - The error to examine.
 *
 * @return {Boolean}
 */
function couldNotConnect(error) {
  return ((error.code && error.code === 'ECONNREFUSED') || (error.status && error.status === 502));
}
