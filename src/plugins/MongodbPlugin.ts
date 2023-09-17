import {DI, DockerService} from "@wocker/core";
import {demuxOutput, promptConfirm, promptSelect} from "@wocker/utils";
import * as Path from "path";
import * as dateFns from "date-fns";
import {Cli} from "@kearisp/cli";

import {DATA_DIR} from "src/env";
import {
    Docker,
    Logger,
    Plugin,
    FS
} from "src/makes";


class MongodbPlugin extends Plugin {
    protected container = "mongodb.workspace";
    protected adminContainer = "dbadmin-mongodb.workspace";
    protected dockerService: DockerService

    public constructor(di: DI) {
        super("mongodb");

        this.dockerService = di.resolveService<DockerService>(DockerService);
        this.dataDir = Path.join(DATA_DIR, "db/mongodb");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("mongodb:start").action(() => {
            return this.start();
        });

        cli.command("mongodb:stop").action(() => {
            return this.stop();
        });

        cli.command("mongodb:restart").action(() => {
            return this.restart();
        });

        cli.command("mongodb:backup [database]")
            .completion("database", () => {
                return this.getDatabases();
            })
            .action((options, database?: string) => {
                return this.backup(database);
            });

        cli.command("mongodb:restore [database] [filename]")
            .completion("database", () => {
                const dumpPath = this.dataPath("dump");

                return FS.readdir(dumpPath);
            })
            .completion("filename", (options, database: string) => {
                if(!database) {
                    return [];
                }

                const dirPath = this.dataPath("dump", database);

                if(!FS.existsSync(dirPath)) {
                    return [];
                }

                return FS.readdir(dirPath);
            })
            .action((options, database?: string, filename?: string) => {
                return this.restore(database, filename);
            });

        cli.command("mongodb:delete-backup [database] [filename]")
            .option("yes", {
                type: "boolean",
                alias: "y"
            })
            .completion("database", () => {
                return this.getDatabasesDumps();
            })
            .completion("filename", (options, database?: string) => {
                if(!database) {
                    return [];
                }

                const dumpPath = this.dataPath("dump", database);

                if(!FS.existsSync(dumpPath)) {
                    return [];
                }

                return FS.readdirFiles(dumpPath);
            })
            .action((options, database?: string, filename?: string) => {
                return this.deleteBackup(database, filename, options.yes)
            });
    }

    async getDatabases() {
        const stream = await Docker.exec(
            this.container,
            [
                "mongosh",
                "--username", "root",
                "--password", "toor",
                "--quiet",
                "--eval", "db.getMongo().getDBNames().forEach(function(i){print(i)})"
            ],
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

        return res.split(/\r?\n/).filter((database: string) => {
            return !!database;
        });
    }

    async getDatabasesDumps() {
        const dumpDir = this.dataPath("dump");

        return FS.readdir(dumpDir);
    }

    async start() {
        console.log("Mongidb starting...");

        await Docker.pullImage("mongo:latest");

        const container = await this.dockerService.createContainer({
            name: this.container,
            restart: "always",
            image: "mongo:latest",
            volumes: [
                `${this.dataPath()}:/data/db`
            ],
            ports: ["27017:27017"],
            env: {
                MONGO_INITDB_ROOT_USERNAME: "root",
                MONGO_INITDB_ROOT_PASSWORD: "toor",
                MONGO_ROOT_USER: "root",
                MONGO_ROOT_PASSWORD: "toor"
            }
        });

        await container.start();

        await this.startAdmin();
    }

    async startAdmin() {
        console.log("Mongodb Admin starting...");

        await Docker.pullImage("mongo-express:latest");

        const container = await this.dockerService.createContainer({
            name: this.adminContainer,
            restart: "always",
            env: {
                ME_CONFIG_MONGODB_SERVER: this.container,
                ME_CONFIG_MONGODB_PORT: "27017",
                MONGO_ROOT_USER: "root",
                MONGO_ROOT_PASSWORD: "toor",
                ME_CONFIG_MONGODB_ADMINUSERNAME: "root",
                ME_CONFIG_MONGODB_ADMINPASSWORD: "toor",
                ME_CONFIG_MONGODB_ENABLE_ADMIN: "true",
                ME_CONFIG_MONGODB_AUTH_DATABASE: "admin",
                ME_CONFIG_MONGODB_AUTH_USERNAME: "root",
                ME_CONFIG_MONGODB_AUTH_PASSWORD: "toor",
                VIRTUAL_HOST: this.adminContainer,
                VIRTUAL_PORT: "8081"
            },
            image: "mongo-express:latest"
        });

        await container.start();
    }

    async stop() {
        await this.stopDB();
        await this.stopAdmin();
    }

    public async stopDB() {
        console.log("Mongodb stopping...");

        const container = await this.dockerService.getContainer(this.container);

        if(container) {
            try {
                await container.stop();
                await container.remove();
            }
            catch(err) {
                Logger.error(err.message);
            }
        }
    }

    async stopAdmin() {
        console.log("Mongodb Admin stopping...");

        await this.dockerService.removeContainer(this.adminContainer);
    }

    async restart() {
        await this.stop();

        await this.start();
    }

    async backup(database?: string) {
        if(!database) {
            database = await promptSelect({
                message: "Database",
                options: await this.getDatabases()
            });
        }

        const date = dateFns.format(new Date(), "yyyy-MM-dd HH-mm");
        const dirPath = this.dataPath("dump", database);
        const filePath = this.dataPath("dump", database, `${date}.gz`);

        if(!FS.existsSync(dirPath)) {
            FS.mkdirSync(dirPath, {
                recursive: true
            });
        }

        const stream = await Docker.exec(this.container, [
            "mongodump",
            "--authenticationDatabase", "admin",
            "--host", `${this.container}:27017`,
            "--username", "root",
            "--password", "toor",
            "--db", database,
            "--archive",
            "--gzip"
        ], false);

        const file = FS.createWriteStream(filePath);

        stream.on("data", (data) => {
            file.write(demuxOutput(data));
        });

        await new Promise((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
        });
    }

    async deleteBackup(database?: string, filename?: string, yes?: boolean) {
        if(!database) {
            database = await promptSelect({
                message: "Database",
                options: await this.getDatabasesDumps()
            });
        }

        if(!database) {
            throw new Error("No database");
        }

        const dirPath = this.dataPath("dump", database);

        if(!FS.existsSync(dirPath)) {
            throw new Error(`Backups dir for database "${database}" not found`);
        }

        if(!filename) {
            const files = await FS.readdirFiles(dirPath);

            if(files.length === 0) {
                throw new Error(`No backups for ${database}`);
            }

            filename = await promptSelect({
                message: "File",
                options: files
            });
        }

        const filePath = this.dataPath("dump", database, filename);

        if(!FS.existsSync(filePath)) {
            throw new Error(`Backup "${filename}" not found`);
        }

        if(!yes) {
            yes = await promptConfirm({
                message: `Delete ${filename}?`,
                default: false
            });
        }

        if(!yes) {
            return;
        }

        await FS.rm(filePath);

        const otherFiles = await FS.readdir(dirPath);

        if(otherFiles.length === 0) {
            await FS.rm(dirPath, {
                force: true,
                recursive: true
            });
        }
    }

    async restore(database?: string, filename?: string) {
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

        if(!filename) {
            const filenames = await FS.readdir(this.dataPath("dump", database));

            filename = await promptSelect({
                message: "File",
                options: filenames
            });
        }

        const path = this.dataPath("dump", database, filename);
        const file = FS.createReadStream(path);
        const stream = await Docker.exec(this.container, [
            "mongorestore",
            "--authenticationDatabase", "admin",
            "--host", `${this.container}:27017`,
            "--username", "root",
            "--password", "toor",
            "--db", database,
            "--drop",
            "--gzip",
            "--archive"
        ], false);

        file.on("data", (data) => {
            stream.write(data);
        });

        file.on("end", () => {
            throw new Error("File end")
        });

        stream.on("error", (err) => {
            file.close();

            throw err;
        });

        console.log(path);
    }
}


export {MongodbPlugin};