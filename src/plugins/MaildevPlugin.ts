import {DI, DockerService} from "@wocker/core";
import {Cli} from "@kearisp/cli";

import {Plugin} from "src/makes";


class MaildevPlugin extends Plugin {
    protected containerName = "maildev.workspace";
    protected dockerService: DockerService;

    public constructor(di: DI) {
        super("maildev");

        this.dockerService = di.resolveService<DockerService>(DockerService);
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("maildev:start")
            .action(() => this.start());

        cli.command("maildev:stop")
            .action(() => this.stop());
    }

    public async start() {
        console.log("Maildev starting...");

        const imageName = "ws-maildev";

        if(!await this.dockerService.imageExists(imageName)) {
            await this.dockerService.buildImage({
                tag: "ws-maildev",
                buildArgs: {},
                labels: {},
                context: this.pluginPath(),
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


export {MaildevPlugin};
