const { AddCommand } = require('../commands/add');
const { DevCommand } = require('../commands/dev');
const { MigrateCommand } = require('../commands/migrate');
const { RollbackCommand } = require('../commands/rollback');
const { StripeCommand } = require('../commands/stripe');
const { TailwindCommand } = require('../commands/tailwind');
const { TestCommand } = require('../commands/test');
const { NewCommand } = require('../commands/new');
const { UpCommand } = require('../commands/up');

module.exports = {
  add: AddCommand,
  dev: DevCommand,
  migrate: MigrateCommand,
  rollback: RollbackCommand,
  stripe: StripeCommand,
  tailwind: TailwindCommand,
  test: TestCommand,
  new: NewCommand,
  up: UpCommand,
};
