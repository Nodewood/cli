const { AddCommand } = require('../commands/add');
const { DevCommand } = require('../commands/dev');
const { EjectCommand } = require('../commands/eject');
const { MigrateCommand } = require('../commands/migrate');
const { NewCommand } = require('../commands/new');
const { RollbackCommand } = require('../commands/rollback');
const { ScriptCommand } = require('../commands/script');
const { SeedCommand } = require('../commands/seed');
const { StopCommand } = require('../commands/stop');
const { StripeCommand } = require('../commands/stripe');
const { TailwindCommand } = require('../commands/tailwind');
const { TestCommand } = require('../commands/test');
const { UpCommand } = require('../commands/up');

module.exports = {
  add: AddCommand,
  dev: DevCommand,
  eject: EjectCommand,
  migrate: MigrateCommand,
  new: NewCommand,
  rollback: RollbackCommand,
  script: ScriptCommand,
  seed: SeedCommand,
  stop: StopCommand,
  stripe: StripeCommand,
  tailwind: TailwindCommand,
  test: TestCommand,
  up: UpCommand,
};
