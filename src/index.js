require('dotenv').config();

const chalk = require('chalk');
const figlet = require('figlet');
const { get } = require('lodash');
const commands = require('./lib/commands');
const { showHelp, showDetailedHelp } = require('./lib/help');
const { version } = require('../package.json');

console.log(chalk.yellow(figlet.textSync('Nodewood', { horizontalLayout: 'full' })));
console.log(`CLI Version ${version}\n`);

const args = require('minimist')(process.argv.slice(2));
const command = get(args._, 0, false);

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
  // TODO: Ensure in a Nodewood project

  const instance = new commands[command]();
  instance.execute(args);
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
