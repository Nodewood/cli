const chalk = require('chalk');

/**
 * Show general CLI help.
 *
 * @param {String} command - The command to show detailed help for.
 * @param {Object} commands - The commands to get help text from.
 */
function showHelp(commands) {
  console.log(`For additional help on a command, type ${chalk.cyan('nodewood help COMMAND')}.\n`);

  console.log('Commands:');

  // eslint-disable-next-line no-restricted-syntax
  for (let command of Object.keys(commands)) {
    const paddedName = pad('          ', command);
    const instance = new commands[command]();
    console.log(`  ${chalk.green(paddedName)} - ${chalk.yellow(instance.helpLine())}`);
  }

  console.log('\nGlobal flags:');
  console.log(`  ${chalk.cyan('-v')} # Verbose output`);
}

/**
 * Show help for the specified command.
 *
 * @param {String} command - The command to show detailed help for.
 * @param {Object} commands - The commands to get help text from.
 */
function showDetailedHelp(command, commands) {
  const instance = new commands[command]();
  instance.helpDetailed();
}

/**
 * Pad a string with a buffer.
 *
 * @param {String} padBuffer - A buffer to use to replace on left or right with your string.
 * @param {String} str - The string to pad.
 * @param {Boolean} padLeft - If true, the padding should be to the left of the string.
 *
 * @return {String}
 */
function pad(padBuffer, str, padLeft = false) {
  if (typeof str === 'undefined') {
    return padBuffer;
  }

  if (padLeft) {
    return (padBuffer + str).slice(-padBuffer.length);
  }

  return (str + padBuffer).substring(0, padBuffer.length);
}

module.exports = {
  showHelp,
  showDetailedHelp,
};
