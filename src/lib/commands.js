const { AddCommand } = require('../commands/add');
const { DevCommand } = require('../commands/dev');
const { NewCommand } = require('../commands/new');
const { VmCommand } = require('../commands/vm');

module.exports = {
  add: AddCommand,
  dev: DevCommand,
  new: NewCommand,
  vm: VmCommand,
};
