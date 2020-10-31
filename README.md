# Nodewood

Command-line interface for installing and managing [Nodewood](https://nodewood.com) projects.

[Documentation can be found on the Nodewood website](https://nodewood.com/docs/master/getting-started/cli/)

Release numbers may not be sequential, as they are pinned to the version of the Nodewood base code they are supporting.

## Releases

### 0.9.0

- Updates `nodewood dev` command to work with Docker.
- Updates `nodewood new` command to work with Docker.
- Adds `--skip-check` option to `nodewood new`.
- Fixes `--overwrite` option for `nodewood new` so that it doesn't empty directory first.
- Updates `nodewood migrate` and `nodewood rollback` commands to work with Docker.
- Removes `nodewood vm` command.

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
