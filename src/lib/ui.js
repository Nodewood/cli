const { Progress } = require('clui');

/**
 * Wrapper around CLUI's `Progress` that makes it easy to increment progress and not have to
 * manage that increment yourself externally.
 */
class IncrementableProgress {
  constructor(total) {
    this.current = 0;
    this.total = total;

    this.bar = new Progress(total);
  }

  /**
   * Display the progres bar in its current state.
   *
   * @param {String} label - The label to prefix the progress bar with.
   *
   * @return {String}
   */
  display({ label = '' } = {}) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${label}${this.bar.update(this.current, this.total)}`);
  }

  /**
   * Increment the bar's value and then display it.
   *
   * @param {Number} by - The number to increment the value by.
   * @param {String} label - The label to prefix the progress bar with.
   *
   * @return {String}
   */
  increment({ by = 1, label = '' } = {}) {
    this.current += by;

    this.display({ label });
  }
}

module.exports = {
  IncrementableProgress,
};
