import {
    DI,
    AppConfigService as CoreAppConfigService,
    AppEventsService as CoreAppEventsService,
    ProjectService as CoreProjectService,
    DockerService,
    Project,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE
} from "@wocker/core";
import {promptSelect, promptText} from "@wocker/utils";
import CliTable from "cli-table3";
import {Cli} from "@kearisp/cli";
import chalk from "chalk";
import * as Path from "path";
import {Mutex} from "async-mutex";

import {DATA_DIR} from "src/env";
import {EnvConfig} from "src/types";
import {Controller, FS, Docker, Logger} from "src/makes";
import {
    getConfig,
    setConfig,
    demuxOutput
} from "src/utils";


type InitOptions = {
    name?: string;
    type?: string;
    preset?: string;
};

type ListOptions = {
    all?: boolean;
};

type StartOptions = {
    name?: string;
    rebuild?: boolean;
    detach?: boolean;
};

type StopOptions = {
    name?: string;
};

type AttachOptions = {
    name?: string;
};

type ConfigOptions = {
    name?: string;
    global?: boolean;
};

type BuildArgsOptions = {
    name?: string;
};

type VolumeOptions = {
    name?: string;
};

type LogsOptions = {
    name?: string;
    global?: boolean;
    detach?: boolean;
    follow?: boolean;
};

type ExecOptions = {
    name?: string;
};

class ProjectController extends Controller {
    protected appConfigService: CoreAppConfigService;
    protected appEventsService: CoreAppEventsService;
    protected projectService: CoreProjectService;
    protected dockerService: DockerService;

    public constructor(
        protected di: DI
    ) {
        super();

        this.appConfigService = this.di.resolveService<CoreAppConfigService>(CoreAppConfigService);
        this.appEventsService = this.di.resolveService<CoreAppEventsService>(CoreAppEventsService);
        this.projectService = this.di.resolveService<CoreProjectService>(CoreProjectService);
        this.dockerService = this.di.resolveService<DockerService>(DockerService);
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("init")
            .help({
                description: "Init project"
            })
            .option("name", {
                type: "string",
                description: "Ім'я контейнеру",
                alias: "n"
            })
            .option("type", {
                type: "string",
                description: "Тип запуску контейнеру"
            })
            .completion("type", () => {
                return [];
            })
            .option("preset", {
                type: "string",
                description: "Preset",
                default: ""
            })
            .action((options) => this.init(options));

        cli.command("ps")
            .option("all", {
                type: "boolean",
                alias: "a",
                description: "All projects"
            })
            .action((options: ListOptions) => this.projectList(options));

        cli.command("start")
            .help({
                description: "Run project"
            })
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .option("rebuild", {
                type: "boolean",
                alias: "r"
            })
            .option("detach", {
                type: "boolean",
                alias: "d"
            })
            .action((options) => this.start(options));

        cli.command("stop")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options) => this.stop(options));

        cli.command("run <script>")
            .completion("script", (options) => this.getScripts())
            .action((options, script) => this.run(script as string));

        cli.command("attach")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options) => this.attach(options));

        cli.command("config")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .option("global", {
                type: "boolean",
                alias: "g"
            })
            .action((options: ConfigOptions) => this.configList(options));

        cli.command("config:get <key>")
            .help({
                description: "Get project env variable"
            })
            .option("global", {
                alias: "g",
                description: "Global"
            })
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: ConfigOptions, key: string) => this.configGet(options, key));

        cli.command("config:set [...configs]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .option("global", {
                type: "boolean",
                alias: "g"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: ConfigOptions, configs: string[]) => this.configSet(options, configs));

        cli.command("config:unset [...configs]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .option("global", {
                type: "boolean",
                alias: "g"
            })
            .action((options: ConfigOptions, configs: string[]) => this.configUnset(options, configs));

        cli.command("build-args")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options) => this.buildArgsList(options));

        cli.command("build-args:get [...buildArgs]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options, buildArgs: string[]) => this.buildArgsGet(options, buildArgs));

        cli.command("build-args:set [...buildArgs]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options, buildArgs: string[]) => this.buildArgsSet(options, buildArgs));

        cli.command("build-args:unset [...buildArgs]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options, buildArgs: string[]) => this.buildArgsUnset(options, buildArgs));

        cli.command("volumes")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options) => this.volumeList(options));

        cli.command("volume:mount <...volumes>")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: VolumeOptions, volumes: string[]) => this.volumeMount(options, volumes));

        cli.command("volume:unmount <...volumes>")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: VolumeOptions, volumes: string[]) => this.volumeUnmount(options, volumes));

        cli.command("logs")
            .help({
                description: "Logs"
            })
            .option("name", {
                type: "boolean",
                alias: "n"
            })
            .option("global", {
                type: "boolean",
                alias: "g"
            })
            .option("follow", {
                type: "boolean",
                alias: "f"
            })
            .option("detach", {
                type: "boolean",
                alias: "d"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: LogsOptions) => this.logs(options));

        cli.command("exec [...command]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: ExecOptions, command: string[]) => this.exec(options, command));
    }

    protected async getProjectNames() {
        const projects = await Project.search();

        return projects.map((project) => {
            return project.name;
        });
    }

    protected async getScripts() {
        try {
            const project = await this.projectService.get();

            return Object.keys(project.scripts || {});
        }
        catch(ignore) {
            return [];
        }
    }

    public async init(options: InitOptions) {
        let project = await Project.searchOne({
            path: this.appConfigService.getPWD()
        });

        if(!project) {
            project = new Project({});
        }

        if(options.name) {
            project.name = options.name;
        }

        if(!options.name || !project.name) {
            project.name = await promptText({
                type: "string",
                required: true,
                message: "Project name",
                default: project.name
            });
        }

        if(options.type) {
            project.type = options.type;
        }

        const mapTypes = this.appConfigService.getProjectTypes();

        if(!options.type || !project.type || !mapTypes[project.type]) {
            project.type = await promptSelect({
                message: "Project type",
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

    public async projectList(options: ListOptions) {
        const {
            all
        } = options;

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

        return table.toString() + "\n";
    }

    public async start(options: StartOptions) {
        const {
            name,
            rebuild,
            detach
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(rebuild) {
            await this.appEventsService.emit("project:rebuild", project);
        }

        await this.projectService.start(project);

        if(!detach) {
            const project = await this.projectService.get();

            const containerName = `${project.name}.workspace`;

            const container = await Docker.getContainer(containerName);

            await container.resize({
                w: process.stdout.columns,
                h: process.stdout.rows
            });

            await Docker.attach(containerName);
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

        await this.projectService.stop(project);
    }

    public async run(script: string) {
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

    public async attach(options: AttachOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const containerName = `${name}.workspace`;

        await Docker.attach(containerName);
    }

    public async configList(options: ConfigOptions) {
        const {
            name,
            global
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        let env: EnvConfig = {};

        if(!global) {
            const project = await this.projectService.get();

            env = project.env || {};
        }
        else {
            const config = await getConfig();

            env = config.env || {};
        }

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        for(const i in env) {
            table.push([i, env[i]]);
        }

        return table.toString() + "\n";
    }

    public async configGet(options: ConfigOptions, key: string) {
        const {
            name,
            global
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        let value = "";

        if(global) {
            const config = await getConfig();

            value = config[key] || "";
        }
        else {
            const project = await this.projectService.get();

            value = project.getEnv(key);
        }

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        table.push([key, value]);

        return table.toString() + "\n";
    }

    public async configSet(options: ConfigOptions, configs: string[]) {
        const {
            name,
            global
        } = options;

        const env: Project["env"] = configs.reduce((env, config) => {
            const [key, value] = config.split("=");

            env[key.trim()] = value.trim();

            return env;
        }, {});

        if(global) {
            const config = await getConfig();

            await setConfig({
                ...config,
                env: {
                    ...config.env || {},
                    ...env
                }
            });

            return;
        }

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        for(const i in env) {
            project.setEnv(i, env[i]);
        }

        await project.save();
    }

    public async configUnset(options: ConfigOptions, configs: string[]) {
        const {
            name,
            global
        } = options;

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
    }

    public async buildArgsList(options: BuildArgsOptions) {
        const {
            name
        } = options;

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

        return table.toString() + "\n";
    }

    public async buildArgsGet(options: BuildArgsOptions, args: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        Logger.info("...");

        for(const key of args) {
            if(project.buildArgs && typeof project.buildArgs[key] !== "undefined") {
                const value = project.buildArgs[key] || "";

                table.push([key, value]);
            }
        }

        return table.toString() + "\n";
    }

    public async buildArgsSet(options: BuildArgsOptions, args: string[]) {
        const {
            name
        } = options;

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

    public async buildArgsUnset(options: BuildArgsOptions, args: string[]) {
        const {
            name
        } = options;

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

    public async volumeList(options: VolumeOptions) {
        const {
            name
        } = options;

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

        return table.toString() + "\n";
    }

    public async volumeMount(options: VolumeOptions, volumes: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        console.log(volumes);

        project.volumeMount(...volumes);

        await project.save();
    }

    public async volumeUnmount(options: VolumeOptions, volumes: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.volumeUnmount(...volumes);

        await project.save();
    }

    public async logs(options: LogsOptions) {
        const {
            name,
            global,
            detach,
            follow
        } = options;

        if(global) {
            const logFilepath = Path.join(DATA_DIR, "ws.log");

            const prepareLog = (str: string) => {
                return str.replace(/^\[.*]\s([^:]+):\s.*$/gm, (substring, type) => {
                    switch(type) {
                        case "info":
                            return chalk.green(substring);

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
                            console.log("file truncated");

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

        const container = await Docker.getContainer(`${project.name}.workspace`);

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

    public async exec(options: ExecOptions, command: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const containerName = `${project.name}.workspace`;

        await Docker.exec(containerName, command);
    }
}


export {ProjectController};
