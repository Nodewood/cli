class Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpShort() {
    return '';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpLong() {
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
