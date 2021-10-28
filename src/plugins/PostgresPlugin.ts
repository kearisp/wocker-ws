import {Cli} from "@kearisp/cli";
import * as Path from "path";

import {DATA_DIR} from "src/env";
import {
    Plugin,
    Docker,
    Logger
} from "src/makes";


class PostgresPlugin extends Plugin {
    protected container = "postgres.workspace";
    protected adminContainer = "dbadmin-postgres.workspace";

    public constructor() {
        super("postgres");

        this.dataDir = Path.join(DATA_DIR, "db/postgres");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("postgres:start")
            .action(() => this.start());

        cli.command("postgres:stop")
            .action(() => this.stop());

        cli.command("postgres:restart")
            .action(() => this.restart());
    }

    async start() {
        await this.startDB();
        await this.startAdmin();
    }

    protected async startDB() {
        console.log("Postgres starting...");

        await Docker.pullImage("postgres:latest");

        const container = await Docker.createContainer({
            name: this.container,
            restart: "always",
            image: "postgres:latest",
            volumes: [
                `${this.dataPath()}:/var/lib/postgresql/data`
            ],
            ports: ["5432:5432"],
            env: {
                POSTGRES_USER: "root",
                POSTGRES_PASSWORD: "toor"
            }
        });

        await container.start();
    }

    protected async startAdmin() {
        console.log("Postgres Admin starting...");

        await Docker.pullImage("dpage/pgadmin4:latest");

        const container = await Docker.createContainer({
            name: this.adminContainer,
            restart: "always",
            links: [
                `${this.container}:postgres`
            ],
            env: {
                PGADMIN_DEFAULT_EMAIL: "postgres@workspace.com.ua",
                PGADMIN_DEFAULT_PASSWORD: "toor",
                VIRTUAL_HOST: this.adminContainer
            },
            image: "dpage/pgadmin4:latest"
        });

        await container.start();
    }

    async stop() {
        await this.stopDB();
        await this.stopAdmin();
    }

    protected async stopDB() {
        console.log("Postgres stopping...");

        const container = await Docker.getContainer(this.container);

        if(container) {
            try {
                await container.stop();
                await container.remove();
            }
            catch(err) {
                Logger.error((err as Error).message);
            }
        }
    }

    protected async stopAdmin() {
        console.log("Stopping postgres admin...");

        const container = await Docker.getContainer(this.adminContainer);

        if(container) {
            try {
                await container.stop();
                await container.remove();
            }
            catch(err) {
                Logger.error((err as Error).message);
            }
        }
    }

    public async restart() {
        await this.stop();

        await this.start();
    }
}


export {PostgresPlugin};