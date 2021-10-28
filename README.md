# Workspace

###### Docker workspace for web projects

## Requirements

- [node.js](https://nodejs.org)
- [docker](https://www.docker.com)


## Usage

### Installation

```shell
npm i -g @kearisp/workspace
```

### Project initialization

```text
127.0.0.1 <domain>
```

```shell
cd /project-dir
ws init
ws domain:add <domain>
```

### Starting project container

```shell
ws start -d
```

Options:
- --detach, -d -

[//]: # (TODO)


### Proxy

```shell
ws proxy:start
```

#### Logs

```shell
ws proxy:logs
```


### Mariadb

#### Installation

To access the following services within the workspace, please add the following entries to your hosts file:

```text
127.0.0.1 maildev.workspace
127.0.0.1 dbadmin-mariadb.workspace
```


#### Start Mariadb

```shell
ws maridb:start
```

### Backup db

The `mariadb:backup` command is used to create a backup of a MariaDB database.

```shell
ws mariadb:backup [database]
```

#### Backup Location

The backup file will be saved in the following directory:

> $WS_DIR/plugins/mariadb/dump/**\[dbname]**/yyyy-MM-dd HH-mm.sql


### Delete backup

The `mariadb:delete-backup` command will remove file from `$WS_DIR` directory.

```shell
ws mariadb:delete-backup [database] [filename]
```

### Dump

The `mariadb:dump` command is used to dump a MariaDB database to a file.

```shell
ws mairadb:dump [database] > dump.sql
```


## Technologies

- [typescript](https://www.typescriptlang.org)
- [dockerode](https://npmjs.org/package/dockerode)


## Environments

You can add `WS_DIR` into `.bashrc` for changing ws data path.

```shell
export WS_DIR="$HOME/.workspace"
```


### Completion

```bash
source <(ws completion script)
```


## Folders structure

```text
├── bin/
├── plugins/
│   ├── localtunnel/
│   ├── maildev/
│   ├── mariadb/
│   └── ngrok/
├── presets/
│   ├── apache/
│   ├── go/
│   ├── node/
│   └── shopify/
├── plugins/
└── src/
    ├── makes/
    │   └── index.ts
    ├── models/
    │   └── index.ts
    ├── types/
    │   └── index.ts
    ├── utils/
    │   └── index.ts
    ├── App.ts
    ├── env.ts
    └── index.ts 
```
