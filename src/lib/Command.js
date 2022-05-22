const { get } = require('lodash');

class Command {
  constructor(args) {
    this.verboseMode = get(args, 'v', false);
  }

  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return '';
  }

  /**
   * Logs a message under all conditions.
   *
   * @param {String} message - The message to log.
   */
  log(message) {
    console.log(message);
  }

  /**
   * Logs a message when the verbose (-v) flag is set.
   *
   * @param {String} message - The message to log.
   */
  verbose(message) {
    if (this.verboseMode) {
      console.log(message);
    }
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    return '';
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  execute(args) {

  }
}

module.exports = {
  Command,
};
