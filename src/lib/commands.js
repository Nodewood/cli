const { AddCommand } = require('../commands/add');
const { NewCommand } = require('../commands/new');
const { VmCommand } = require('../commands/vm');

module.exports = {
  add: AddCommand,
  new: NewCommand,
  vm: VmCommand,
};
