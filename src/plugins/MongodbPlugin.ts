import {Controller, FileSystem} from "@wocker/core";
import {promptConfirm, promptSelect} from "@wocker/utils";
import {DATA_DIR} from "../env";
import {DockerService} from "../modules";


@Controller()
export class MongodbPlugin {
    protected container = "mongodb.workspace";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public get fs(): FileSystem {
        return (new FileSystem(DATA_DIR)).cd("db/mongodb");
    }

    public getDatabasesDumps(): string[] {
        return this.fs.readdir("dump");
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

        if(!this.fs.exists(`dump/${database}`)) {
            throw new Error(`Backups dir for database "${database}" not found`);
        }

        if(!filename) {
            const files = this.fs.readdir(`dump/${database}`);

            if(files.length === 0) {
                throw new Error(`No backups for ${database}`);
            }

            filename = await promptSelect({
                message: "File",
                options: files
            });
        }

        if(!this.fs.exists(`dump/${database}/${filename}`)) {
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

        this.fs.rm(`dump/${database}/${filename}`);

        const otherFiles = this.fs.readdir(`dump/${database}`);

        if(otherFiles.length === 0) {
            this.fs.rm(`dump/${database}`, {
                force: true,
                recursive: true
            });
        }
    }

    async restore(database?: string, filename?: string) {
        if(!database) {
            const dumps = this.fs.readdir("dump");

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
            const filenames = this.fs.readdir(`dump/${database}`);

            filename = await promptSelect({
                message: "File",
                options: filenames
            });
        }

        const file = this.fs.createReadStream(`dump/${database}/${filename}`);
        const stream = await this.dockerService.exec(this.container, [
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
    }
}
