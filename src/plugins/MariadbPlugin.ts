import * as Path from "path";
import format from "date-fns/format";
import {Cli} from "@kearisp/cli";

import {DATA_DIR} from "src/env";
import {Plugin, FS, Docker, Logger} from "src/makes";
import {demuxOutput, promptConfirm, promptSelect} from "src/utils";


class MariadbPlugin extends Plugin {
    protected dbDir: string;
    protected user = "root";
    protected password = "toor";

    public constructor() {
        super("mariadb");

        this.dbDir = Path.join(DATA_DIR, "db/mariadb");
        // this.dataDir = Path.join(PLUGINS_DIR, "mariadb");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("mariadb:start")
            .action(() => this.start());

        cli.command("mariadb:stop")
            .action(() => this.stop());

        cli.command("mariadb:backup [database]")
            .completion("database", () => this.getDatabases())
            .action((options, database?: string) => this.backup(database));

        cli.command("mariadb:delete-backup [database] [filename]")
            .option("yes", {
                type: "boolean",
                alias: "y"
            })
            .completion("database", () => this.getDumpDatabases())
            .completion("filename", (options, database?: string) => this.getDumpFiles(database))
            .action((options, database?: string, filename?: string) => this.deleteBackup(options, database, filename));

        cli.command("mariadb:restore [database] [filename]")
            .completion("database", () => this.getDumpDatabases())
            .completion("filename", (options, database?: string) => this.getDumpFiles(database))
            .action((options, database?: string, filename?: string) => this.restore(options, database, filename));

        cli.command("mariadb:import <database>")
            .completion("database",() => this.getDatabases())
            .action((options, database?: string) => this.import(options, database));

        cli.command("mariadb:dump <database>")
            .completion("database",() => this.getDatabases())
            .action((options, database: string) => this.dump(options, database));

        cli.command("mariadb:exec [...command]")
            .action((options, command: string[]) => this.exec(options, command));
    }

    protected async getDatabases() {
        const stream = await Docker.exec(
            "mariadb.workspace",
            ["mysql", `-u${this.user}`, `-p${this.password}`, "-e", "SHOW DATABASES;"],
            false
        );

        let res = "";

        stream.on("data", (data) => {
            res += demuxOutput(data).toString();
        });

        await new Promise((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
        });

        return res.split(/\r?\n/).filter((database) => {
            return !/Database$/.test(database);
        }).filter((database) => {
            return !/_schema/.test(database);
        }).filter((database) => {
            return !!database;
        });
    }

    protected async getDumpDatabases() {
        return FS.readdir(this.dataPath("dump"));
    }

    protected async getDumpFiles(database?: string) {
        if(!database) {
            return [];
        }

        const dirPath = this.dataPath("dump", database);

        if(!FS.existsSync(dirPath)) {
            return [];
        }

        return FS.readdirFiles(dirPath);
    }

    public async start() {
        await this.startMariadb();
        await this.startAdmin();
    }

    protected async startMariadb() {
        console.info("Mariadb starting...");

        await Docker.pullImage("mariadb:10.5");
        await Docker.containerRun({
            name: "mariadb.workspace",
            restart: "always",
            ports: ["3306:3306"],
            env: {
                MYSQL_ROOT_PASSWORD: "toor"
            },
            volumes: [
                `${this.dbDir}:/var/lib/mysql`
            ],
            image: "mariadb:10.5"
        });
    }

    protected async startAdmin() {
        console.info("Phpmyadmin starting...");

        const configPath = "conf/config.user.inc.php";

        if(!FS.existsSync(this.dataPath(configPath))) {
            await FS.mkdir(Path.dirname(this.dataPath(configPath)), {
                recursive: true
            });

            await FS.copyFile(this.pluginPath("admin", configPath), this.dataPath(configPath));
        }

        await FS.mkdir(this.dataPath("save"), {
            recursive: true
        });

        await FS.mkdir(this.dataPath("upload"), {
            recursive: true
        });

        await Docker.pullImage("phpmyadmin/phpmyadmin:latest");
        await Docker.containerRun({
            name: "dbadmin-mariadb.workspace",
            restart: "always",
            env: {
                PMA_USER: "root",
                PMA_PASSWORD: "toor",
                VIRTUAL_HOST: "dbadmin-mariadb.workspace",
                VIRTUAL_PORT: "80"
            },
            volumes: [
                `${this.dataPath("conf/config.user.inc.php")}:/etc/phpmyadmin/config.user.inc.php`,
                `${this.dataPath("save")}:/etc/phpmyadmin/save`,
                `${this.dataPath("upload")}:/etc/phpmyadmin/upload`
            ],
            links: [
                "mariadb.workspace:db"
            ],
            image: "phpmyadmin/phpmyadmin:latest"
        });
    }

    public async stop() {
        await this.stopMariadb();
        await this.stopAdmin();
    }

    protected async stopMariadb() {
        console.info("Mariadb stopping...");

        const container = await Docker.getContainer("mariadb.workspace");

        if(container) {
            try {
                await container.stop()
            }
            catch(err) {
                Logger.warning((err as Error).message, {
                    class: "MariadbPlugin"
                });
            }

            try {
                await container.remove();
            }
            catch(err) {
                Logger.warning((err as Error).message, {
                    class: "MariadbPlugin"
                });
            }
        }
    }

    protected async stopAdmin() {
        console.info("Phpmyadmin stopping...");

        const container = await Docker.getContainer("dbadmin-mariadb.workspace");

        if(container) {
            try {
                await container.stop()
            }
            catch(err) {
                Logger.warning((err as Error).message, {
                    class: "MariadbPlugin"
                });
            }

            try {
                await container.remove();
            }
            catch(err) {
                Logger.warning((err as Error).message, {
                    class: "MariadbPlugin"
                });
            }
        }
    }

    public async exec(options, command: string[]) {
        await Docker.exec("mariadb.workspace", command);
    }

    public async backup(database?: string) {
        if(!database) {
            database = await promptSelect({
                message: "Database",
                options: await this.getDatabases()
            });
        }

        const date = format(new Date(), "yyyy-MM-dd HH-mm");
        const filePath = this.dataPath("dump", database, `${date}.sql`);

        if(!FS.existsSync(Path.dirname(filePath))) {
            FS.mkdirSync(Path.dirname(filePath), {
                recursive: true
            });
        }

        const file = FS.createWriteStream(filePath);

        const stream = await Docker.exec("mariadb.workspace", [
            "mysqldump",
            "--add-drop-table",
            `-u${this.user}`,
            `-p${this.password}`,
            database
        ], false);

        stream.on("data", (data) => {
            file.write(demuxOutput(data));
        });
    }

    public async deleteBackup(options, database?: string, filename?: string) {
        const {
            yes
        } = options;

        if(!database) {
            const dumps = await this.getDumpDatabases();

            if(dumps.length === 0) {
                throw new Error("No dump databases");
            }

            database = await promptSelect({
                message: "Database",
                options: dumps
            });
        }

        if(!filename) {
            const files = await FS.readdirFiles(this.dataPath("dump", database));

            if(files.length === 0) {
                throw new Error(`No backups for ${database}`);
            }

            filename = await promptSelect({
                message: "File",
                options: files
            });
        }

        if(!yes) {
            const confirm = await promptConfirm({
                message: `Delete ${filename}`,
                default: false
            });

            if(!confirm) {
                return;
            }
        }

        const filePath = this.dataPath("dump", database, filename);

        await FS.rm(filePath);

        const otherFiles = await FS.readdir(this.dataPath("dump", database));

        if(otherFiles.length === 0) {
            await FS.rm(this.dataPath("dump", database), {
                force: true,
                recursive: true
            });
        }
    }

    public async restore(options, database?: string, filename?: string) {
        if(!database) {
            const dumps = await FS.readdir(this.dataPath("dump"));

            if(dumps.length === 0) {
                throw new Error("No dumps found");
            }

            database = await promptSelect({
                message: "Database",
                options: dumps
            });
        }

        if(!database) {
            throw new Error("Need database name");
        }

        const dirs = await FS.readdir(this.dataPath("dump", database));

        if(!filename) {
            filename = await promptSelect({
                message: "File",
                options: dirs
            });
        }

        const path = this.dataPath("dump", database, filename);
        const file = FS.createReadStream(path);
        const stream = await Docker.exec("mariadb.workspace", ["mysql", "-uroot", "-ptoor", database], false);

        file.on("data", (data) => {
            stream.write(data);
        });

        file.on("end", () => {
            stream.write("exit\n");
        });

        stream.on("error", (data) => {
            process.stderr.write(demuxOutput(data));

            stream.write("exit\n");

            file.close();
        });
    }

    public async dump(options, database?: string) {
        const date = format(new Date(), "yyyy-MM-dd HH-mm");

        const dirPath = this.dataPath("dump", database);
        const filePath = this.dataPath("dump", database, `${date}.sql`);

        if(!FS.existsSync(dirPath)) {
            FS.mkdirSync(dirPath, {
                recursive: true
            });
        }

        // const filePath = Path.join(DATA_DIR, `${database} ${date}.sql`);
        // console.log(filePath);

        const file = FS.createWriteStream(filePath);

        const stream = await Docker.exec("mariadb.workspace", ["mysqldump", "-uroot", "-ptoor", database]);

        stream.pipe(file);
    }

    public async import(options, database?: string) {
        const container = await Docker.getContainer("mariadb.workspace");

        const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: process.stdin.isTTY,
            Cmd: [
                "mysql",
                `-u${this.user}`,
                `-p${this.password}`,
                database
            ]
        });

        const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: process.stdin.isTTY
        });

        await Docker.attachStream(stream);
    }
}


export {MariadbPlugin};
