const { AddCommand } = require('../commands/add');
const { DevCommand } = require('../commands/dev');
const { MigrateCommand } = require('../commands/migrate');
const { RollbackCommand } = require('../commands/rollback');
const { StripeCommand } = require('../commands/stripe');
const { NewCommand } = require('../commands/new');
const { UpCommand } = require('../commands/up');
const { VmCommand } = require('../commands/vm');

module.exports = {
  add: AddCommand,
  dev: DevCommand,
  migrate: MigrateCommand,
  rollback: RollbackCommand,
  stripe: StripeCommand,
  new: NewCommand,
  up: UpCommand,
  vm: VmCommand,
};
