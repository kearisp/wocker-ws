import {Cli} from "@kearisp/cli";

import {Plugin, Docker} from "src/makes";
import {Project} from "src/models";
import {
    AppConfigService,
    AppEventsService,
    ProjectService
} from "src/services";
import {followProgress, promptText, promptConfirm} from "src/utils";


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

class PageKitePlugin extends Plugin {
    constructor(
        protected appConfigService: AppConfigService,
        protected appEventsService: AppEventsService,
        protected projectService: ProjectService
    ) {
        super("pagekite");
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appEventsService.on("project:start", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));

        cli.command("pagekite:init")
            .action((options: InitOptions) => this.init(options));

        cli.command("pagekite:start")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .option("restart", {
                type: "boolean",
                alias: "r",
                description: "Restart"
            })
            .action((options: StartOptions) => this.start(options));

        cli.command("pagekite:stop")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: StopOptions) => this.stop(options));

        cli.command("pagekite:build")
            .option("rebuild", {
                type: "boolean",
                alias: "r",
                description: "Rebuild"
            })
            .action((options: BuildOptions) => this.build(options));
    }

    public async onProjectStart(project: Project) {
        if(!project || project.getEnv("PAGEKITE_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Pagekite starting...");

        await this.build();

        let container = await Docker.getContainer(`pagekite-${project.name}`);

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
                await Docker.removeContainer(`pagekite-${project.name}`);
            }
        }

        const subdomain = project.getEnv("PAGEKITE_SUBDOMAIN");

        container = await Docker.createContainer({
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

        await Docker.attachStream(stream);
    }

    public async onProjectStop(project: Project) {
        if(!project || project.getEnv("PAGEKITE_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Pagekite stopping...");

        await Docker.removeContainer(`pagekite-${project.name}`);
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
            await Docker.removeContainer(`pagekite-${project.name}`);
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

        const exists = await Docker.imageExists("ws-pagekite");

        if(rebuild) {
            await Docker.removeContainer("ws-pagekite");
        }

        if(!exists || rebuild) {
            const stream = await Docker.imageBuild2({
                tag: "ws-pagekite",
                context: this.pluginPath(),
                src: "./Dockerfile"
            });

            await followProgress(stream);
        }
    }
}


export {PageKitePlugin};
