import {Cli} from "@kearisp/cli";

import {Plugin, Docker} from "src/makes";


class RedisPlugin extends Plugin {
    protected container = "redis.workspace"

    public constructor() {
        super("redis");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("redis:start")
            .action(() => this.up());

        cli.command("redis:stop")
            .action(() => this.down());
    }

    public async up() {
        console.log("Redis up...");

        await Docker.pullImage("redis");

        const container = await Docker.createContainer({
            name: this.container,
            restart: "always",
            env: {
                VIRTUAL_HOST: this.container
            },
            volumes: [
                `${this.dataPath()}:/data`
            ],
            ports: [
                "6379:6379"
            ],
            image: "redis"
        });

        await container.start();
    }

    public async down() {
        console.log("Redis down...");

        const container = await Docker.getContainer(this.container);

        await container.stop().catch(() => {
            //
        });

        await container.remove();
    }
}


export {RedisPlugin};