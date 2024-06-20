import {
    Controller,
    Completion,
    Command,
    Description,
    Option,
    Param,
    Project,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE,
    EnvConfig
} from "@wocker/core";
import {promptSelect, promptText, demuxOutput} from "@wocker/utils";
import CliTable from "cli-table3";
import chalk from "chalk";
import * as Path from "path";
import {Mutex} from "async-mutex";

import {DATA_DIR} from "../env";
import {FS} from "../makes";
import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService,
    LogService
} from "../services";


@Controller()
export class ProjectController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService,
        protected readonly logService: LogService
    ) {}

    @Completion("name")
    protected async getProjectNames(): Promise<string[]> {
        const projects = await this.projectService.search();

        return projects.map((project) => {
            return project.name;
        });
    }

    @Completion("script")
    public async getScriptNames(): Promise<string[]> {
        try {
            const project = await this.projectService.get();

            return Object.keys(project.scripts);
        }
        catch(err) {
            return [];
        }
    }

    @Command("init")
    public async init(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        @Option("type", {
            type: "string",
            alias: "t",
            description: "Project type"
        })
        type: string,
        @Option("preset", {
            type: "string",
            alias: "p",
            description: "Preset"
        })
        preset: string
    ): Promise<void> {
        let project = await this.projectService.searchOne({
            path: this.appConfigService.getPWD()
        });

        if(!project) {
            project = this.projectService.fromObject({
                path: this.appConfigService.getPWD()
            });
        }

        if(name) {
            project.name = name;
        }

        if(!name || !project.name) {
            project.name = await promptText({
                type: "string",
                required: true,
                message: "Project name:",
                default: project.name || Path.basename(project.path)
            });
        }

        if(type) {
            project.type = type;
        }

        const mapTypes = this.appConfigService.getProjectTypes();

        if(!type || !project.type || !mapTypes[project.type]) {
            project.type = await promptSelect({
                message: "Project type:",
                options: mapTypes,
                default: project.type
            });
        }

        switch(project.type) {
            case PROJECT_TYPE_DOCKERFILE: {
                const files = await FS.readdirFiles(this.appConfigService.getPWD());

                const dockerfiles = files.filter((fileName: string) => {
                    if(new RegExp("^(.*)\\.dockerfile$").test(fileName)) {
                        return true;
                    }

                    return new RegExp("^Dockerfile(\\..*)?").test(fileName);
                });

                project.dockerfile = await promptSelect({
                    options: dockerfiles.map((dockerfile) => {
                        return {
                            value: dockerfile
                        };
                    }),
                    message: "Dockerfile",
                    default: project.dockerfile
                });
                break;
            }

            case PROJECT_TYPE_IMAGE: {
                project.imageName = await promptText({
                    message: "Image Name",
                    default: project.imageName
                });
                break;
            }

            default:
                break;
        }

        await this.appEventsService.emit("project:init", project);

        project.path = this.appConfigService.getPWD();

        await project.save();
    }

    @Command("ps")
    public async projectList(
        @Option("all", {
            type: "boolean",
            alias: "a",
            description: "All projects"
        })
        all: boolean
    ): Promise<string> {
        const table = new CliTable({
            head: ["Name", "Type", "Status"],
            colAligns: ["left", "center", "center"]
        });

        const projects = await this.projectService.search({});

        for(const project of projects) {
            const container = await this.dockerService.getContainer(`${project.name}.workspace`);

            if(!container) {
                if(all) {
                    table.push([project.name, project.type, "-"]);
                }

                continue;
            }

            const {
                State: {
                    Status= "stopped"
                } = {}
            } = await container.inspect();

            table.push([project.name, project.type, Status]);
        }

        return table.toString();
    }

    @Command("start")
    @Description("Starting project")
    public async start(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name",
            help: true
        })
        name?: string,
        @Option("detach", {
            type: "boolean",
            description: "Detach",
            alias: "d"
        })
        detach?: boolean,
        @Option("attach", {
            type: "boolean",
            description: "Attach",
            alias: "a"
        })
        attach?: boolean,
        @Option("build", {
            type: "boolean",
            description: "Build",
            alias: "b"
        })
        rebuild?: boolean,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart"
        })
        restart?: boolean
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(rebuild) {
            await this.projectService.rebuild(project);
        }

        await this.projectService.start(project, restart);

        if(detach) {
            console.info(chalk.yellow("Warning: Detach option is deprecated"));
        }

        if(attach) {
            const project = await this.projectService.get();

            const containerName = project.containerName;

            const container = await this.dockerService.getContainer(containerName);

            await container.resize({
                w: process.stdout.columns,
                h: process.stdout.rows
            });

            await this.dockerService.attach(containerName);
        }
    }

    @Command("stop")
    public async stop(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.projectService.stop(project);
    }

    @Command("run <script>")
    public async run(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        script: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(!project.scripts || !project.scripts[script]) {
            throw new Error(`Script ${script} not found`);
        }

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(!container) {
            throw new Error("The project is not started");
        }

        const exec = await container.exec({
            Cmd: ["bash", "-i", "-c", project.scripts[script]],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: process.stdin.isTTY
        });

        const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: process.stdin.isTTY
        });

        await this.dockerService.attachStream(stream);
    }

    @Command("attach")
    public async attach(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        await this.dockerService.attach(project.containerName);
    }

    @Command("config")
    public async configList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name?: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global?: boolean
    ): Promise<string> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        let env: EnvConfig;

        if(!global) {
            const project = await this.projectService.get();

            env = project.env || {};
        }
        else {
            const config = await this.appConfigService.getConfig();

            env = config.env || {};
        }

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        for(const i in env) {
            table.push([i, env[i]]);
        }

        return table.toString();
    }

    @Command("config:get [...key]")
    public async configGet(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean,
        @Param("key")
        keys: string[]
    ): Promise<string> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        let config = global
            ? await this.appConfigService.getConfig()
            : await this.projectService.get();

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        for(const key of keys) {
            const value = config.getEnv(key, "");

            if(!value) {
                continue;
            }

            table.push([key, value]);
        }

        return table.toString();
    }

    @Command("config:set [...configs]")
    public async configSet(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean,
        variables: string[]
    ) {
        if(!global && name) {
            await this.projectService.cdProject(name);
        }

        const config = global
            ? await this.appConfigService.getConfig()
            : await this.projectService.get();

        for(const variable of variables) {
            const [key, value] = variable.split("=");

            if(!value) {
                console.info(chalk.yellow(`No value for "${key}"`));
                continue;
            }

            config.setEnv(key.trim(), value.trim());
        }

        await config.save();

        if(!global) {
            const project = await this.projectService.get();
            const container = await this.dockerService.getContainer(project.containerName);

            if(container) {
                await this.projectService.start(project, true);
            }
        }
    }

    @Command("config:unset [...configs]")
    public async configUnset(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean,
        configs: string[]
    ) {
        const env: Project["env"] = configs.reduce((env, config) => {
            const [key] = config.split("=");

            env[key.trim()] = null;

            return env;
        }, {});

        if(global) {
            return;
        }

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        for(const i in env) {
            project.unsetEnv(i);
        }

        await project.save();

        if(!global) {
            const project = await this.projectService.get();
            const container = await this.dockerService.getContainer(project.containerName);

            if(container) {
                await this.projectService.start(project, true);
            }
        }
    }

    @Command("build-args")
    public async buildArgsList(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name?: string
    ): Promise<string> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        const buildArgs = project.buildArgs || {};

        for(const i in buildArgs) {
            table.push([i, typeof buildArgs[i] === "string" ? buildArgs[i] : JSON.stringify(buildArgs[i])]);
        }

        return table.toString();
    }

    @Command("build-args:get [...buildArgs]")
    public async buildArgsGet(
        @Option("name", {
            type: "string",
            alias: "n",
        })
        name: string,
        args: string[]
    ): Promise<string> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        this.logService.info("...");

        for(const key of args) {
            if(project.buildArgs && typeof project.buildArgs[key] !== "undefined") {
                const value = project.buildArgs[key] || "";

                table.push([key, value]);
            }
        }

        return table.toString();
    }

    @Command("build-args:set [...buildArgs]")
    public async buildArgsSet(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        args: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const buildArgs: Project["buildArgs"] = args.reduce((env, config) => {
            const [key, value] = config.split("=");

            env[key.trim()] = value.trim();

            return env;
        }, {});

        for(const key in buildArgs) {
            if(!project.buildArgs) {
                project.buildArgs = {};
            }

            project.buildArgs[key] = buildArgs[key];
        }

        await project.save();
    }

    @Command("build-args:unset [...buildArgs]")
    public async buildArgsUnset(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        args: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const buildArgs: Project["buildArgs"] = args.reduce((env, config) => {
            const [key, value] = config.split("=");

            env[key.trim()] = value.trim();

            return env;
        }, {});

        for(const key in buildArgs) {
            if(!project.buildArgs) {
                break;
            }

            if(typeof project.buildArgs[key] !== "undefined") {
                delete project.buildArgs[key];
            }
        }

        await project.save();
    }

    @Command("volumes")
    public async volumeList(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name?: string
    ): Promise<string> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const table = new CliTable({
            head: ["Volume"]
        });

        const volumes = project.volumes || [];

        for(const volume of volumes) {
            table.push([volume]);
        }

        return table.toString();
    }

    @Command("volume:mount [...volumes]")
    public async volumeMount(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        volumes: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(Array.isArray(volumes) && volumes.length > 0) {
            project.volumeMount(...volumes)

            await project.save();
        }
    }

    @Command("volume:unmount [...volumes]")
    public async volumeUnmount(
        @Option("name", {
            type: "string",
            alias: "n"
        })
        name: string,
        volumes: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(Array.isArray(volumes) && volumes.length > 0) {
            project.volumeUnmount(...volumes);

            await project.save();
        }
    }

    @Command("logs")
    public async logs(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean,
        @Option("detach", {
            type: "boolean",
            alias: "d"
        })
        detach: boolean,
        @Option("follow", {
            type: "boolean",
            alias: "f"
        })
        follow: boolean
    ) {
        if(global) {
            const logFilepath = Path.join(DATA_DIR, "ws.log");

            const prepareLog = (str: string) => {
                return str.replace(/^\[.*]\s([^:]+):\s.*$/gm, (substring, type) => {
                    switch(type) {
                        case "debug":
                            return chalk.grey(substring);

                        case "log":
                            return chalk.white(substring);

                        case "info":
                            return chalk.green(substring);

                        case "warn":
                        case "warning":
                            return chalk.yellow(substring);

                        case "error":
                            return chalk.red(substring);

                        default:
                            return substring;
                    }
                });
            };

            const stream = FS.createReadLinesStream(logFilepath, follow ? -10 : undefined);

            stream.on("data", (data) => {
                process.stdout.write(prepareLog(data.toString()));
                process.stdout.write("\n");
            });

            if(follow) {
                const stats = await FS.stat(logFilepath);
                const watcher = FS.watch(logFilepath);
                const mutex = new Mutex();

                let position = BigInt(stats.size);

                watcher.on("change", async () => {
                    await mutex.acquire();

                    try {
                        const stats = await FS.stat(logFilepath);

                        if(BigInt(stats.size) < position) {
                            console.info("file truncated");

                            position = 0n;
                        }

                        const buffer = await FS.readBytes(logFilepath, position);

                        position += BigInt(buffer.length);

                        process.stdout.write(prepareLog(buffer.toString("utf-8")));
                    }
                    finally {
                        mutex.release();
                    }
                });
            }

            return;
        }

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(!detach) {
            const stream = await container.logs({
                stdout: true,
                stderr: true,
                follow: true
            });

            stream.on("data", (data) => {
                process.stdout.write(demuxOutput(data));
            });
        }
        else {
            const buffer = await container.logs({
                stdout: true,
                stderr: true,
                follow: false
            });

            process.stdout.write(demuxOutput(buffer));
        }
    }

    @Command("exec [...command]")
    public async exec(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name?: string,
        command?: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const containerName = `${project.name}.workspace`;

        await this.dockerService.exec(containerName, command);
    }
}
