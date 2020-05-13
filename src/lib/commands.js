const { AddCommand } = require('../commands/add');
const { DevCommand } = require('../commands/dev');
const { MigrateCommand } = require('../commands/migrate');
const { RollbackCommand } = require('../commands/rollback');
const { NewCommand } = require('../commands/new');
const { VmCommand } = require('../commands/vm');

module.exports = {
  add: AddCommand,
  dev: DevCommand,
  migrate: MigrateCommand,
  rollback: RollbackCommand,
  new: NewCommand,
  vm: VmCommand,
};
