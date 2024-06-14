import {Controller, Project} from "@wocker/core";
import {promptText, promptConfirm} from "@wocker/utils";

import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService
} from "../services";


type InitOptions = {
    //
};

type StartOptions = {
    name?: string;
    detach?: boolean;
    restart?: boolean;
    rebuild?: boolean;
};

type StopOptions = {
    name?: string;
};

type BuildOptions = {
    rebuild?: boolean;
};

@Controller()
export class PageKitePlugin {
    constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService
    ) {}

    public pluginPath(...parts: string[]): string {
        return this.appConfigService.pluginsPath("pagekite", ...parts);
    }

    // public install(cli: Cli) {
    //     this.appEventsService.on("project:start", (project: Project) => this.onProjectStart(project));
    //     this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));
    //
    //     cli.command("pagekite:init")
    //         .action((options: InitOptions) => this.init(options));
    //
    //     cli.command("pagekite:start")
    //         .option("name", {
    //             type: "string",
    //             alias: "n",
    //             description: "Project name"
    //         })
    //         .option("restart", {
    //             type: "boolean",
    //             alias: "r",
    //             description: "Restart"
    //         })
    //         .action((options: StartOptions) => this.start(options));
    //
    //     cli.command("pagekite:stop")
    //         .option("name", {
    //             type: "string",
    //             alias: "n",
    //             description: "Project name"
    //         })
    //         .action((options: StopOptions) => this.stop(options));
    //
    //     cli.command("pagekite:build")
    //         .option("rebuild", {
    //             type: "boolean",
    //             alias: "r",
    //             description: "Rebuild"
    //         })
    //         .action((options: BuildOptions) => this.build(options));
    // }

    public async onProjectStart(project: Project) {
        if(!project || project.getEnv("PAGEKITE_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Pagekite starting...");

        await this.build();

        let container = await this.dockerService.getContainer(`pagekite-${project.name}`);

        if(container) {
            const {
                State: {
                    Running
                }
            } = await container.inspect();

            if(Running) {
                console.info("Pagekite is already running");

                return;
            }
            else {
                await this.dockerService.removeContainer(`pagekite-${project.name}`);
            }
        }

        const subdomain = project.getEnv("PAGEKITE_SUBDOMAIN");

        container = await this.dockerService.createContainer({
            name: `pagekite-${project.name}`,
            image: "ws-pagekite",
            tty: true,
            restart: "always",
            cmd: [
                "python",
                "pagekite.py",
                `${project.name}.workspace:80`,
                `${subdomain}.pagekite.me`
            ]
        });

        await container.start();

        await container.resize({
            w: process.stdout.columns,
            h: process.stdout.rows
        });

        const stream = await container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true,
            logs: true
        });

        stream.on("data", (data) => {
            if(/Kites are flying and all is well\./.test(data.toString())) {
                stream.end();
            }
        });

        await this.dockerService.attachStream(stream);
    }

    public async onProjectStop(project: Project) {
        if(!project || project.getEnv("PAGEKITE_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Pagekite stopping...");

        await this.dockerService.removeContainer(`pagekite-${project.name}`);
    }

    public async init(options: InitOptions) {
        const project = await this.projectService.get();

        const enabled = await promptConfirm({
            message: "Enable pagekite",
            default: project.getEnv("PAGEKITE_ENABLE", "true") === "true"
        });

        if(enabled) {
            project.setEnv("PAGEKITE_ENABLE", "true");

            const subdomain = await promptText({
                message: "Subdomain",
                prefix: "https://",
                suffix: ".pagekite.me",
                default: project.getEnv("PAGEKITE_SUBDOMAIN", project.name)
            });

            project.setEnv("PAGEKITE_SUBDOMAIN", subdomain)
        }
        else {
            project.setEnv("PAGEKITE_ENABLE", "false");
        }

        await project.save();
    }

    public async start(options: StartOptions) {
        const {
            name,
            restart
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(restart) {
            await this.dockerService.removeContainer(`pagekite-${project.name}`);
        }

        await this.onProjectStart(project);
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

    public async build(options: BuildOptions = {}) {
        const {
            rebuild
        } = options;

        const exists = await this.dockerService.imageExists("ws-pagekite");

        if(rebuild) {
            await this.dockerService.removeContainer("ws-pagekite");
        }

        if(!exists || rebuild) {
            await this.dockerService.buildImage({
                tag: "ws-pagekite",
                context: this.pluginPath(),
                src: "./Dockerfile"
            });
        }
    }
}
