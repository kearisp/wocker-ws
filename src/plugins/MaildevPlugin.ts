import {Cli} from "@kearisp/cli";

import {Plugin, Docker} from "src/makes";


class MaildevPlugin extends Plugin {
    protected containerName = "maildev.workspace";

    public constructor() {
        super("maildev");
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

        if(!await Docker.imageExists(imageName)) {
            await Docker.imageBuild({
                tag: "ws-maildev",
                buildArgs: {},
                labels: {},
                context: this.pluginPath(),
                src: "./Dockerfile"
            });
        }

        await Docker.containerRun({
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
    }

    public async stop() {
        console.log("Maildev stopping...");

        await Docker.removeContainer(this.containerName);
    }
}


export {MaildevPlugin};
