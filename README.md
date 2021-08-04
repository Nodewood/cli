# Nodewood

Command-line interface for installing and managing [Nodewood](https://nodewood.com) projects.

[Documentation can be found on the Nodewood website](https://nodewood.com/docs/getting-started/cli/)

## Unreleased

## Releases

### 0.15.2

- Fixes custom plural not being respected when creating a feature.

### 0.15.1

- Fixes `dev` command not working without the `-d` option.

### 0.15.0

- Adds `-d` option to `dev` command to allow for detached mode.
- Adds `stop` command to stop projects running in detached mode.
- Bumps glob-parent from 5.1.1 to 5.1.2.

### 0.14.2

- Fixes a bug when loading local state-level taxes.

### 0.14.1

- Removes instructions to run `yarn install`.

### 0.14.0

- Updates & installs dependencies in `app/package.json` when updating Nodewood library.

### 0.13.3

- Removes superfluous logs issued during `nodewood dev`.

### 0.13.2

- Adds support for alternate docker-compose commands.

### 0.13.1

- Removes temporary API containers after migrate/rollback.
- Updates config file location for feature add explainer text.
- Updates example migrate command after adding new feature.
- Fixes issue where Stripe diff would fail with empty tax list.
- Adds check for minimum version of Node.js.
- Displays local Nodewood library version, if applicable.

### 0.13.0

- Modifies `add:feature` to create a more fully-functional feature.

### 0.12.2

- Updates added Stores to use plural of provided name.

### 0.12.1

- Updates docs links to new location on website.

### 0.12.0

- Adds better error messaging for when the Nodewood server is down.
- Adds useful information after performing an upgrade.
- Displays command help when expected command suffix is absent.
- Adds `nodewood eject` command.

### 0.11.0

- Adds `nodewood tailwind:prefix` command.
- Adds prefix to Tailwind CSS classes in `wood` folder on upgrade, if defined in Tailwind config.

### 0.10.4

- No longer attempts to template Vagrantfile on new project.
- Downloads zipfiles outside of target folder to fix Windows delete bug.
- Appends a random string of characters to downloaded zipfile to avoid conflicts.

### 0.10.3

- Uses sync version of remove to delete downloaded zip files.

### 0.10.2

- Improved error messages for missing programs.

### 0.10.1

- Spawns commands directly, in order to better run on Windows.

### 0.10.0

- Adds `nodewood test` command.
- Modifies all docker commands to run from `app/docker` or fall back to `wood/docker` directory directly.
- Removes `nodewood up:docker` command.
- Fixes error where no command is given.
- Provides docker-compose project name based on Nodewood project dir when starting docker containers.
- Adds execute bit to extracted scripts when created new or upgrading project.

### 0.9.1

- Ensures Yarn is installed before `nodewood new` can be run.
- Installs node modules as part of `nodewood new`.
- Copies .env file as part of `nodewood new`.

### 0.9.0

- Updates `nodewood dev` command to work with Docker.
- Updates `nodewood new` command to work with Docker.
- Adds `--skip-check` option to `nodewood new`.
- Fixes `--overwrite` option for `nodewood new` so that it doesn't empty directory first.
- Updates `nodewood migrate` and `nodewood rollback` commands to work with Docker.
- Changes `test` parameter for `nodewood migrate` to an option (`--test`).
- Removes `nodewood vm` command.
- Adds `nodewood up:docker` command.
- Renames `nodewood stripe` and `nodewood add` commands to use a colon separator (`nodewood stripe:diff`, etc).

### 0.8.5

- Removes the check for Ansible, Vagrant, VirtualBox, and Yarn on new project creation.

### 0.8.1

- Installation instructions now happen on every install.

### 0.8.0

- Updates lodash for security.
- Simplified and improved Stripe config format/syncing.
- Fixes bug where using CLI outside of active Nodewood project folder fails.
- Adds installation instructions to the end of `new` command.

### 0.6.0

- Adds `nodewood stripe` command.

### 0.5.2

- Update README with documentation link.
- Updates package.json scripts.

### 0.5.1

- Stores are now created in /stores subdirectory.

### 0.5.0

- Check for installed programs before running `new` command.
- Adds help for custom plurals.

### 0.4.0

- Adds `nodewood up` command.

### 0.3.0

- Adds `nodewood migrate` command.
- Adds `nodewood rollback` command.

### 0.2.0

- Adds `nodewood dev` command.
- Adds `nodewood vm` command.

### 0.1.0

- Initial release.
