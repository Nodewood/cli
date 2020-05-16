#!/usr/bin/env node
require('dotenv').config();

const chalk = require('chalk');
const figlet = require('figlet');
const { get } = require('lodash');
const { readJsonSync } = require('fs-extra');
const { resolve } = require('path');
const commands = require('../src/lib/commands');
const { showHelp, showDetailedHelp } = require('../src/lib/help');

const packageObj = readJsonSync(resolve(__dirname, '../package.json'));

console.log(chalk.yellow(figlet.textSync('Nodewood', { horizontalLayout: 'full' })));
console.log(`CLI Version ${packageObj.version}\n`);

const args = require('minimist')(process.argv.slice(2));
const command = get(args._, 0, false);

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

(async () => {
  // Display generic help
  if (isInvalidCommand(command, commands) || isInvalidHelpCommand(command, args, commands)) {
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
      const instance = new commands[command]();
      await instance.execute(args);
    }
    catch (error) {
      if (process.env.NODE_DEV === 'development') {
        console.log('Logging error in development mode:');
        console.log(error);
      }

      console.log(chalk.red(`Could not complete your command.  If this continues, please email ${chalk.cyan('admin@nodewood.com')} for assistance.\n`));

      if (get(error, 'response.body.errors')) {
        const errorMessage = error.response.body.errors
          .map((errorEntry) => errorEntry.title)
          .join('. ');

        console.log(`Error message: ${errorMessage}`);
      }
      else {
        console.log(`Error message: ${error.message}`);
      }
    }
  }
})();
