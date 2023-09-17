import {
    Project,
    DI,
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService,
    Logger
} from "@wocker/core";
import {promptConfirm, promptText} from "@wocker/utils";
import axios from "axios";
import {Cli} from "@kearisp/cli";

import {Plugin} from "src/makes";


type InitOptions = {
    name?: string;
};

type StartOptions = {
    name?: string;
    detach?: boolean;
};

type StopOptions = {
    name?: string;
};

type LogsOptions = {
    name?: string;
    detach?: boolean;
};

class LocaltunnelPlugin extends Plugin {
    protected appConfigService: AppConfigService;
    protected appEventsService: AppEventsService;
    protected projectService: ProjectService;
    protected dockerService: DockerService;

    public constructor(di: DI) {
        super("localtunnel");

        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
        this.appEventsService = di.resolveService<AppEventsService>(AppEventsService);
        this.projectService = di.resolveService<ProjectService>(ProjectService);
        this.dockerService = di.resolveService<DockerService>(DockerService);
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appEventsService.on("project:start", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));

        cli.command("localtunnel:init")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .action((options: InitOptions) => this.init(options));

        cli.command("localtunnel:start")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .option("detach", {
                type: "boolean",
                alias: "d",
                description: "Detach"
            })
            .action((options: StartOptions) => this.start(options));

        cli.command("localtunnel:restart")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .option("detach", {
                type: "boolean",
                alias: "d",
                description: "Detach"
            })
            .action((options: StartOptions) => this.restart(options));

        cli.command("localtunnel:stop")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .action((options: StopOptions) => this.stop(options));

        cli.command("localtunnel:build")
            .action(() => this.build());

        cli.command("localtunnel:rebuild")
            .action(() => this.rebuild());

        cli.command("localtunnel:logs")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .option("detach", {
                type: "boolean",
                alias: "d",
                description: "Detach"
            })
            .action((options: LogsOptions) => this.logs(options));
    }

    public async getIp() {
        const res = await axios.get("https://ipv4.icanhazip.com");

        return (res.data as string).replace("\n", "");
    }

    public async onProjectStart(project: Project) {
        if(!project || project.getEnv("LOCALTUNNEL_ENABLE", "false") !== "true") {
            return;
        }

        let container = await this.dockerService.getContainer(`localtunnel-${project.name}`);

        if(container) {
            const {
                State: {
                    Running
                }
            } = await container.inspect();

            if(Running) {
                console.info("Localtunnel is already running");

                return;
            }
            else {
                await this.dockerService.removeContainer(`localtunnel-${project.name}`);
            }
        }

        console.info("Localtunnel starting...");

        Logger.info(`Localtunnel start: ${project.name}`);

        await this.build();

        const subdomain = project.getEnv("LOCALTUNNEL_SUBDOMAIN", project.name);

        container = await this.dockerService.createContainer({
            name: `localtunnel-${project.name}`,
            image: "ws-localtunnel",
            // tty: true,
            restart: "always",
            networkMode: "host",
            cmd: [
                "lt",
                `--port=80`,
                // `--local-host=${project.name}.workspace`,
                `--subdomain=${subdomain}`,
                "--print-requests"
            ]
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

        const link: string = await new Promise((resolve, reject) => {
            let res = "";

            stream.on("data", (data) => {
                const regLink = /(https?):\/\/(\w[\w.-]+[a-z]|\d+\.\d+\.\d+\.\d+)(?::(\d+))?/;

                if(regLink.test(data.toString())) {
                    const [link] = regLink.exec(data.toString());

                    if(link.includes(".loca.lt")) {
                        res = link;

                        stream.end();
                    }
                }
            });

            stream.on("end", () => resolve(res));
            stream.on("error", reject);
        });

        Logger.info(`${project.name} localtunnel forwarding: ${link}`);

        const ip = await this.getIp();

        console.info(`IP: ${ip}`);
        console.info(`Forwarding: ${link}`);

        if(project.getEnv("LOCALTUNNEL_AUTO_CONFIRM", "false") === "true") {
            console.info("Skipping IP confirmation...");

            const res = await axios.get(link, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36"
                },
                validateStatus: () => true
            });

            const [path] = /\/continue\/[\w.]+/.exec(res.data) || [];

            if(path) {
                const sendData = new URLSearchParams({
                    endpoint: ip
                });

                const res = await axios.post(`${link}${path}`, sendData.toString(), {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    }
                });

                if(res.status === 200) {
                    console.info("IP confirmed");
                }
            }
        }
    }

    public async onProjectStop(project: Project) {
        if(!project || project.getEnv("LOCALTUNNEL_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Localtunnel stopping...");

        await this.dockerService.removeContainer(`localtunnel-${project.name}`);
    }

    public async build() {
        const exists = await this.dockerService.imageExists("ws-localtunnel");

        if(!exists) {
            await this.dockerService.buildImage({
                tag: "ws-localtunnel",
                context: this.pluginPath(),
                src: "./Dockerfile"
            });
        }
    }

    public async rebuild() {
        try {
            await this.dockerService.imageRm("ws-localtunnel");
        }
        catch(err) {
            console.info(err.message);
        }

        await this.build();
    }

    public async init(options: InitOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const enabled = await promptConfirm({
            message: "Enable localtunnel?",
            default: project.getEnv("LOCALTUNNEL_ENABLE", "false") === "true"
        });

        if(enabled) {
            const subdomain = await promptText({
                message: "Subdomain",
                prefix: "https://",
                suffix: ".loca.lt",
                default: project.getEnv("LOCALTUNNEL_SUBDOMAIN")
            });

            if(!subdomain) {
                throw new Error("Subdomain can't be empty");
            }

            const autoConfirmIP = await promptConfirm({
                message: "Do you want to skip the IP confirmation form automatically?",
                default: project.getEnv("LOCALTUNNEL_AUTO_CONFIRM", "true") === "true"
            });

            project.setEnv("LOCALTUNNEL_ENABLE", "true");
            project.setEnv("LOCALTUNNEL_SUBDOMAIN", subdomain);
            project.setEnv("LOCALTUNNEL_AUTO_CONFIRM", autoConfirmIP ? "true" : "false");
        }
        else {
            project.setEnv("LOCALTUNNEL_ENABLE", "false");
        }

        await project.save();
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

        if(project.getEnv("LOCALTUNNEL_ENABLE", "false") !== "true") {
            throw new Error(`Localtunnel is not initialized. Run "ws localtunnel:init${name ? ` -n=${name}` : ""}" first.`);
        }

        await this.onProjectStart(project);

        if(!detach) {
            await this.logs({name});
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
            name,
            // detach
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const container = await this.dockerService.getContainer(`localtunnel-${project.name}`);

        const stream = await container.logs({
            follow: true,
            stderr: true,
            stdout: true,
            tail: 5
        });

        stream.on("data", (data) => {
            process.stdout.write(data);
        });

        stream.on("error", (data) => {
            process.stderr.write(data);
        });
    }
}


export {LocaltunnelPlugin};
