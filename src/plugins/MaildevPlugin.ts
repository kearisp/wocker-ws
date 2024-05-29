import {Controller} from "@wocker/core";

import {DockerService, AppConfigService} from "../services";


@Controller()
export class MaildevPlugin {
    protected containerName = "maildev.workspace";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {}

    // public install(cli: Cli) {
    //     cli.command("maildev:start")
    //         .action(() => this.start());
    //
    //     cli.command("maildev:stop")
    //         .action(() => this.stop());
    // }

    public async start() {
        console.log("Maildev starting...");

        const imageName = "ws-maildev";

        if(!await this.dockerService.imageExists(imageName)) {
            await this.dockerService.buildImage({
                tag: "ws-maildev",
                buildArgs: {},
                labels: {},
                context: this.appConfigService.pluginsPath("plugins/maildev"),
                src: "./Dockerfile"
            });
        }

        let container = await this.dockerService.createContainer({
            name: this.containerName,
            restart: "always",
            env: {
                VIRTUAL_HOST: "maildev.workspace"
            },
            ports: [
                "25:25"
            ],
            image: imageName
        });

        await container.start();
    }

    public async stop() {
        console.log("Maildev stopping...");

        await this.dockerService.removeContainer(this.containerName);
    }
}
