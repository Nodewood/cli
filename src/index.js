const clear = require('clear');
const chalk = require('chalk');
const figlet = require('figlet');
const { get } = require('lodash');
const commands = require('./lib/commands');

// Parse inputs
// Attempt to find command
// If found, create new Command and run it
// If not found, run new HelpCommand

clear();
console.log(chalk.yellow(figlet.textSync('Nodewood', { horizontalLayout: 'full' })));

const args = require('minimist')(process.argv.slice(2));
const command = get(args._, 0, false);

if (! command || ! Object.keys(commands).includes(command)) {
  console.log('help');
}
else {
  console.log(command);
}
