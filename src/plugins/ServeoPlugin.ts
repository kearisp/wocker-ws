import {Cli} from "@kearisp/cli";

import {Plugin, Docker, FS, Logger} from "src/makes";
import {Project} from "src/models";
import {
    AppConfigService,
    AppEventsService,
    ProjectService
} from "src/services";
import {followProgress, demuxOutput, promptConfirm, promptText} from "src/utils";


type InitOptions = {
    name?: string;
};

type StartOptions = {
    name?: string;
    rebuild?: boolean;
    detach?: boolean;
};

type StopOptions = {
    name?: string;
};

type LogsOptions = {
    name?: string;
    detach?: boolean;
};

class ServeoPlugin extends Plugin {
    public constructor(
        protected appConfigService: AppConfigService,
        protected appEventsService: AppEventsService,
        protected projectService: ProjectService
    ) {
        super("serveo");
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appEventsService.on("project:start", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));

        cli.command("serveo:init")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .action((options: InitOptions) => this.init(options));

        cli.command("serveo:start")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .option("detach", {
                alias: "d",
                type: "boolean",
                description: "Detach"
            })
            .option("rebuild", {
                alias: "r",
                type: "boolean",
                description: "Rebuild"
            })
            .action((options: StartOptions) => this.start(options));

        cli.command("serveo:restart")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .option("detach", {
                alias: "d",
                type: "boolean",
                description: "Detach"
            })
            .option("rebuild", {
                alias: "r",
                type: "boolean",
                description: "Rebuild"
            })
            .action((options: StartOptions) => this.restart(options));

        cli.command("serveo:stop")
            .option("name", {
                alias: "n",
                type: "string",
                description: "Project name"
            })
            .action((options: StopOptions) => this.stop(options));

        cli.command("serveo:build")
            .action(() => this.build());

        cli.command("serveo:rebuild")
            .action(() => this.rebuild());

        cli.command("serveo:logs")
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

    public async onProjectStart(project: Project) {
        if(!project || project.getEnv("SERVEO_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Serveo starting...");

        await this.build();

        const subdomain = project.getEnv(`SERVEO_SUBDOMAIN`);

        await FS.mkdir(this.dataPath(".ssh"), {
            recursive: true
        });

        let container = await Docker.getContainer(`serveo-${project.name}`);

        if(container) {
            const {
                State: {
                    Running
                }
            } = await container.inspect();

            if(Running) {
                console.info("Serveo is already running");

                return;
            }
            else {
                await Docker.removeContainer(`serveo-${project.name}`);
            }
        }

        container = await Docker.createContainer({
            name: `serveo-${project.name}`,
            image: "ws-serveo",
            tty: true,
            restart: "always",
            volumes: [
                `${this.dataPath(".ssh")}:/home/user/.ssh`
            ]
        });

        await container.start();

        const stream = await container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true,
            logs: true
        });

        await container.resize({
            w: process.stdout.columns,
            h: process.stdout.rows
        });

        const lsExec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Cmd: [
                "ls", "/home/user/.ssh/"
            ]
        });

        const lsStream = await lsExec.start({});

        const ls = await new Promise((resolve, reject) => {
            let ls = "";

            lsStream.on("data", (data) => {
                ls += demuxOutput(data);
            });

            lsStream.on("end", () => {
                resolve(ls);
            });

            lsStream.on("error", reject);
        });

        if(ls === "") {
            stream.write("ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa\n");
        }
        else {
            Logger.log(JSON.stringify(ls));
        }

        stream.write(`autossh -R ${subdomain ? `${subdomain}.serveo.net:` : ""}80:${project.name}.workspace:80 serveo.net\n`);

        stream.on("data", (data) => {
            Logger.log(data);

            if(/Forwarding HTTP traffic/.test(data.toString())) {
                stream.end();
            }
        });

        await Docker.attachStream(stream);
    }

    public async onProjectStop(project: Project) {
        if(!project || project.getEnv("SERVEO_ENABLE", "false") !== "true") {
            return;
        }

        console.info("Serveo stopping...");

        await Docker.removeContainer(`serveo-${project.name}`);
    }

    public async init(options: InitOptions) {
        const {
            name
        } = options;

        const project = await Project.searchOne(name ? {name} : {src: this.appConfigService.getPWD()});

        if(!project) {
            throw new Error(`Project not found`);
        }

        const enabled = await promptConfirm({
            message: "Enable serveo?",
            default: project.getEnv("SERVEO_ENABLE", "true") === "true"
        });

        if(enabled) {
            project.setEnv("SERVEO_ENABLE", "true");

            const subdomain = await promptText({
                message: "Subdomain",
                prefix: "https://",
                suffix: ".serveo.net",
                default: project.getEnv("SERVEO_SUBDOMAIN", project.name)
            });

            project.setEnv("SERVEO_SUBDOMAIN", subdomain);
        }
        else {
            project.setEnv("SERVEO_ENABLE", "false");
        }

        await project.save();
    }

    public async start(options: StartOptions) {
        const {
            name,
            detach,
            rebuild
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(rebuild) {
            await this.rebuild();
        }

        await this.onProjectStart(project);

        // const project = await Project.
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

        await this.stop({
            name
        });

        await this.start(options);
    }

    public async build() {
        const exists = await Docker.imageExists("ws-serveo")

        if(!exists) {
            const stream = await Docker.imageBuild2({
                tag: "ws-serveo",
                context: this.pluginPath(),
                src: "./Dockerfile"
            });

            await followProgress(stream);
        }
    }

    public async rebuild() {
        const exists = await Docker.imageExists("ws-serveo");

        if(exists) {
            await Docker.imageRm("ws-serveo");
        }

        await this.build();
    }

    public async logs(options: LogsOptions) {
        const {
            name,
            detach
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const container = await Docker.getContainer(`serveo-${project.name}`);

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


export {ServeoPlugin};
