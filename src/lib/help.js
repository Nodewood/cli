/**
 * Show general CLI help.
 *
 * @param {String} command - The command to show detailed help for.
 * @param {Object} commands - The commands to get help text from.
 */
function showHelp(commands) {
  console.log('general help');
}

/**
 * Show help for the specified command.
 *
 * @param {String} command - The command to show detailed help for.
 * @param {Object} commands - The commands to get help text from.
 */
function showDetailedHelp(command, commands) {
  console.log('detailed help');
}

module.exports = {
  showHelp,
  showDetailedHelp,
};
