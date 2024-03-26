import {FSManager, Controller} from "@wocker/core";
import {Cli} from "@kearisp/cli";

import {
    AppConfigService,
    DockerService
} from "../services";


@Controller()
export class RedisPlugin {
    protected container = "redis.workspace";
    protected commander = "redis-commander.workspace";
    protected fs: FSManager;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {
        this.fs = new FSManager(
            this.appConfigService.pluginsPath("redis"),
            this.appConfigService.dataPath("plugins/redis")
        );
    }

    public install(cli: Cli) {
        cli.command("redis:start")
            .action(() => this.up());

        cli.command("redis:stop")
            .action(() => this.down());
    }

    public async up() {
        console.log("Redis up...");

        await this.dockerService.pullImage("redis");

        let container = await this.dockerService.getContainer(this.container);

        if(!container) {
            await this.fs.mkdir("", {
                recursive: true
            });

            container = await this.dockerService.createContainer({
                name: this.container,
                image: "redis",
                restart: "always",
                env: {
                    VIRTUAL_HOST: this.container
                },
                volumes: [
                    `${this.fs.path()}:/data`
                ],
                ports: [
                    "6379:6379"
                ]
            });
        }

        await container.start();

        await this.startCommander();
    }

    protected async startCommander() {
        console.info("RedisCommander starting...");

        let container = await this.dockerService.getContainer(this.commander);

        if(!container) {
            await this.dockerService.pullImage("rediscommander/redis-commander:latest");

            container = await this.dockerService.createContainer({
                name: this.commander,
                image: "rediscommander/redis-commander:latest",
                restart: "always",
                env: {
                    VIRTUAL_HOST: this.commander,
                    VIRTUAL_PORT: "8081",
                    REDIS_HOSTS: this.container
                }
            });
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "created" || Status === "exited") {
            await container.start();
        }
    }

    public async down() {
        console.log("Redis down...");

        await this.dockerService.removeContainer(this.container);

        await this.stopCommander();
    }

    protected async stopCommander() {
        console.info("RedisCommander stopping...");

        await this.dockerService.removeContainer(this.commander);
    }
}
