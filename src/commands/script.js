const chalk = require('chalk');
const spawn = require('cross-spawn');
const { Command } = require('../lib/Command');
const { isNodewoodProject, getProjectName } = require('../lib/file');
const { getDockerCompose, getDockerConfigFolder } = require('../lib/docker');

class ScriptCommand extends Command {
  /**
   * Returns the one-liner version of help text to display on the general help command.
   *
   * @return {String}
   */
  helpLine() {
    return 'Runs a CLI script.';
  }

  /**
   * Returns the full help text specific to the command.
   *
   * @return {String}
   */
  helpDetailed() {
    console.log(this.helpLine());

    console.log(chalk.yellow('\nUsage:'));
    console.log('  nodewood script NAME ARGS');
  }

  /**
   * Execute the command.
   *
   * @param {Array} args - Command arguments, as parsed by minimist.
   */
  async execute(args) {
    if (! isNodewoodProject()) {
      console.log(chalk.red('The current directory is not a Nodewood project.\nPlease re-run your command from the root of a Nodewood project.')); // eslint-disable-line max-len
      return;
    }

    const flagArgs = Object.entries(args).filter((e) => e[0] !== '_').map((e) => {
      if (e[0].length === 1) {
        return e[1] === true ? `-${e[0]}` : `-${e[0]} ${e[1]}`;
      }

      return e[1] === true ? `--${e[0]}` : `--${e[0]}=${e[1]}`;
    });
    const argString = args._.slice(1).concat(flagArgs).join(' ');

    const { composeCommand, composeArgs } = getDockerCompose();
    const dockerFolder = getDockerConfigFolder();
    const projectName = getProjectName();

    spawn(composeCommand, [...composeArgs, '-p', projectName, '-f', `${dockerFolder}/docker-compose.yml`, 'run', '--rm', 'api', '/bin/bash', '-c', `node app/cli/script.js ${argString}`], { stdio: 'inherit' });
  }
}

module.exports = {
  ScriptCommand,
};
