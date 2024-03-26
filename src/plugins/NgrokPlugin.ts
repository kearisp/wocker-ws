import {Controller, DockerService, Project} from "@wocker/core";
import {demuxOutput, promptText, promptConfirm} from "@wocker/utils";
import {Cli} from "@kearisp/cli";

import {Logger} from "../makes";
import {
    AppEventsService,
    ProjectService
} from "../services";


type StartOptions = {
    name?: string;
    detach?: string;
};

type StopOptions = {
    name?: string;
};

type LogsOptions = {
    name?: string;
};

type AttachOptions = {
    name?: string;
};

type ForwardingOptions = {
    name?: string;
};

@Controller()
export class NgrokPlugin {
    public constructor(
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService
    ) {}

    public install(cli: Cli) {
        this.appEventsService.on("project:start", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));

        cli.command("ngrok:init")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .action((options) => this.init(options));

        cli.command("ngrok:start")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .option("detach", {
                type: "boolean",
                alias: "d",
                description: "Detach"
            })
            .action((options: StartOptions) => this.start(options));

        cli.command("ngrok:stop")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: StopOptions) => this.stop(options));

        cli.command("ngrok:restart")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .option("detach", {
                type: "boolean",
                alias: "d",
                description: "Detach"
            })
            .action((options: StartOptions) => this.restart(options));

        cli.command("ngrok:logs")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: LogsOptions) => this.logs(options));

        cli.command("ngrok:attach")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: AttachOptions) => this.attach(options));

        cli.command("ngrok:forwarding")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: ForwardingOptions) => this.forwarding(options));
    }

    public async init(options) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const enable = await promptConfirm({
            message: "Enable ngrok?",
            default: true
        });

        if(enable) {
            const token = await promptText({
                message: "Token",
                default: project.getEnv("NGROK_AUTHTOKEN")
            });

            project.setEnv("NGROK_AUTHTOKEN", token);
            project.setEnv("NGROK_ENABLE", "true");
        }
        else {
            project.setEnv("NGROK_ENABLE", "false");
        }

        await project.save();
    }

    public async getForwarding(project: Project): Promise<string | undefined> {
        const container = await this.dockerService.getContainer(`ngrok-${project.name}`);

        if(!container) {
            throw new Error(`Ngrok for "${project.name}" not started`);
        }

        const {
            NetworkSettings: {
                Networks: {
                    workspace
                }
            }
        } = await container.inspect();

        const stream = await this.dockerService.exec("proxy.workspace", [
            "curl", `http://${workspace.IPAddress}:4040/api/tunnels/command_line`
        ], false);

        const res: string = await new Promise((resolve, reject) => {
            let res = "";

            stream.on("data", (data) => {
                res += demuxOutput(data).toString();
            });

            stream.on("end", () => resolve(res));
            stream.on("error", reject);
        });

        const tunnel = JSON.parse(res);

        return tunnel.public_url;
    }

    public async onProjectStart(project: Project) {
        if(!project || project.getEnv("NGROK_ENABLE", "false") !== "true") {
            return;
        }

        const container1 = await this.dockerService.getContainer(`ngrok-${project.name}`);

        if(container1) {
            const {
                State: {
                    Running
                }
            } = await container1.inspect();

            if(Running) {
                console.log("Ngrok is already running");

                const forwarding = await this.getForwarding(project);

                console.log(`Forwarding: ${forwarding}`);

                return;
            }
            else {
                await this.dockerService.removeContainer(`ngrok-${project.name}`);
            }
        }

        console.log("Ngrok starting...");

        Logger.info(`Ngrok start: ${project.name}`);

        await this.dockerService.pullImage("ngrok/ngrok:latest");

        const container = await this.dockerService.createContainer({
            name: `ngrok-${project.name}`,
            image: "ngrok/ngrok:latest",
            tty: true,
            restart: "always",
            env: {
                NGROK_AUTHTOKEN: project.getEnv("NGROK_AUTHTOKEN")
            },
            cmd: ["http", `${project.name}.workspace:80`]
        });

        const stream = await container.attach({
            logs: true,
            stream: true,
            hijack: true,
            stdin: true,
            stdout: true,
            stderr: true
        });

        stream.setEncoding("utf8");

        await container.start();

        await container.resize({
            w: 90,
            h: 40
        });

        await new Promise((resolve, reject) => {
            stream.on("data", (data) => {
                const regLink = /(https?):\/\/(\w[\w.-]+[a-z]|\d+\.\d+\.\d+\.\d+)(?::(\d+))?/;

                if(regLink.test(data.toString())) {
                    const [link] = regLink.exec(data.toString());

                    if(link.includes(".ngrok")) {
                        Logger.info(`${project.name} forwarding: ${link}`);
                        console.log(`Forwarding: ${link}`);

                        stream.end();
                    }
                }
            });

            stream.on("end", resolve);
            stream.on("error", reject);
        });
    }

    public async onProjectStop(project: Project) {
        if(!project || project.getEnv("NGROK_ENABLE", "false") !== "true") {
            return;
        }

        console.log("Ngrok stopping...");

        await this.dockerService.removeContainer(`ngrok-${project.name}`);
    }

    public async start(options: StartOptions) {
        const {
            name,
            detach
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.onProjectStart(project);

        if(!detach) {
            await this.dockerService.attach(`ngrok-${project.name}`);
        }
    }

    public async stop(options: StopOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.onProjectStop(project);
    }

    public async restart(options: StartOptions) {
        const {
            name
        } = options;

        await this.stop({name});
        await this.start(options);
    }

    public async logs(options: LogsOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const container = await this.dockerService.getContainer(`ngrok-${project.name}`);

        if(!container) {
            throw new Error("Ngrok not started");
        }
    }

    public async attach(options: AttachOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.dockerService.attach(`ngrok-${project.name}`);
    }

    public async forwarding(options: ForwardingOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        return this.getForwarding(project);
    }
}
