import {
    Controller,
    Completion,
    Command,
    Description,
    Option,
    Param,
    Project,
    ProjectType,
    FileSystem,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE,
    PROJECT_TYPE_PRESET,
    PROJECT_TYPE_COMPOSE,
    EnvConfig,
    AppConfigService,
    EventService,
    LogService,
    ProcessService
} from "@wocker/core";
import {promptSelect, promptInput} from "@wocker/utils";
import CliTable from "cli-table3";
import colors from "yoctocolors-cjs";
import * as Path from "path";
import {Mutex} from "async-mutex";
// noinspection ES6PreferShortImport
import {DockerService} from "../modules/docker";
// noinspection ES6PreferShortImport
import {ProjectService, ProjectRepository} from "../modules/project";


@Controller()
@Description("Project commands")
export class ProjectController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly processService: ProcessService,
        protected readonly eventService: EventService,
        protected readonly projectService: ProjectService,
        protected readonly projectRepository: ProjectRepository,
        protected readonly logService: LogService,
        protected readonly dockerService: DockerService
    ) {}

    @Completion("name")
    protected async getProjectNames(): Promise<string[]> {
        const projects = this.projectRepository.search();

        return projects.map((project) => {
            return project.name;
        });
    }

    @Completion("script")
    public async getScriptNames(): Promise<string[]> {
        try {
            const project = this.projectService.get();

            return Object.keys(project.scripts);
        }
        catch(err) {
            return [];
        }
    }

    @Command("init")
    @Description("Project initialisation")
    public async init(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string,
        @Option("type", {
            type: "string",
            alias: "t",
            description: "Project type"
        })
        type: ProjectType
    ): Promise<void> {
        const fs = new FileSystem(this.processService.pwd());
        let project = this.projectRepository.searchOne({
            path: fs.path()
        });

        if(!project) {
            project = this.projectRepository.fromObject({
                path: fs.path()
            });
        }

        project.path = fs.path();

        if(name) {
            project.name = name;
        }

        if(!name || !project.name) {
            project.name = await promptInput({
                required: "Project name is required",
                message: "Project name",
                type: "text",
                default: project.name || Path.basename(project.path),
                validate: (name) => {
                    if(typeof name !== "string") {
                        return true;
                    }

                    const otherProject = this.projectRepository.searchOne({
                        name
                    });

                    if(otherProject && otherProject.path !== project.path) {
                        return `Project "${name}" already exists`;
                    }

                    return true;
                }
            });

            project.addDomain(project.containerName);
        }

        if(type) {
            project.type = type;
        }

        const mapTypes = this.appConfigService.getProjectTypes();

        if(!type || !project.type || !mapTypes[project.type]) {
            project.type = await promptSelect<ProjectType>({
                message: "Project type",
                required: true,
                options: mapTypes,
                default: project.type as ProjectType
            });
        }

        switch(project.type) {
            case PROJECT_TYPE_DOCKERFILE: {
                const files = fs.readdir();

                const dockerfiles = files.filter((fileName: string) => {
                    if(new RegExp("^(.*)\\.dockerfile$").test(fileName)) {
                        return true;
                    }

                    return new RegExp("^Dockerfile(\\..*)?").test(fileName);
                });

                if(dockerfiles.length === 0) {
                    throw new Error("Dockerfiles not found");
                }

                project.dockerfile = await promptSelect({
                    message: "Dockerfile",
                    required: true,
                    options: dockerfiles.map((dockerfile) => {
                        return {
                            value: dockerfile
                        };
                    }),
                    default: project.dockerfile
                });
                break;
            }

            case PROJECT_TYPE_IMAGE: {
                project.imageName = await promptInput({
                    message: "Image name",
                    required: true,
                    default: project.imageName
                });
                break;
            }

            case PROJECT_TYPE_COMPOSE: {
                const composeFiles = fs.readdir().filter((file: string) => {
                    return /docker-compose\./.test(file);
                });

                if(composeFiles.length === 0) {
                    throw new Error("docker-compose files not found")
                }

                project.composefile = await promptSelect({
                    message: "Docker compose",
                    required: true,
                    options: composeFiles,
                    default: project.composefile
                });
                break;
            }

            case PROJECT_TYPE_PRESET:
                break;

            default:
                throw new Error("Invalid project type");
        }

        await this.eventService.emit("project:init", project);

        project.save();
    }

    @Command("destroy [name]")
    @Description("Permanently destroy a project")
    public async destroy(
        @Param("name")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.stop(project);

        this.appConfigService.removeProject(project.id);
        this.appConfigService.save();
        this.appConfigService.fs.rm(`projects/${project.id}`, {
            recursive: true
        });
    }

    @Command("ps")
    @Description("Projects list")
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

        const projects = this.projectRepository.search();

        for(const project of projects) {
            const container = await this.dockerService.getContainer(project.containerName);

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

    @Command("domains")
    @Description("Project domain list")
    public async domains(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

        const table = new CliTable({
            head: [colors.yellow("Domain")]
        });

        for(const domain of project.domains) {
            table.push([domain]);
        }

        return table.toString();
    }

    @Command("domain:add [...domains]")
    @Description("Adding project domain")
    public async addDomain(
        @Param("domains")
        addDomains: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        for(const domain of addDomains) {
            project.addDomain(domain);
        }

        project.save();

        // const container = await this.dockerService.getContainer(`${project.name}.workspace`);
        //
        // if(container) {
        //     await this.projectService.stop(project);
        //     await this.projectService.start(project);
        // }
    }

    @Command("domain:set [...domains]")
    @Description("Setting project domains")
    public async setDomains(
        @Param("domains")
        domains: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.clearDomains();

        for(const domain of domains) {
            project.addDomain(domain);
        }

        project.save();

        // const container = await this.dockerService.getContainer(`${project.name}.workspace`);
        //
        // if(container) {
        //     await this.projectService.stop(project);
        //     await this.projectService.start(project);
        // }
    }

    @Command("domain:remove [...domains]")
    @Description("Removing project domain")
    public async removeDomain(
        @Param("domains")
        removeDomains: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        for(const domain of removeDomains) {
            project.removeDomain(domain);
        }

        project.save();
    }

    @Command("domain:clear")
    @Description("Clearing project domain")
    public async clearDomain(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.clearDomains();

        project.save();

        // const container = await this.dockerService.getContainer(`${project.name}.workspace`);
        //
        // if(container) {
        //     await this.projectService.stop(project);
        //     await this.projectService.start(project);
        // }
    }

    @Command("ports")
    public async ports(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

        const table = new CliTable({
            head: ["Ports"]
        });

        for(const port of project.ports || []) {
            table.push([port]);
        }

        return table.toString();
    }

    @Command("port:add <host-port>:<container-port>")
    public async addPort(
        @Param("host-port")
        hostPort: string,
        @Param("container-port")
        containerPort: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.linkPort(parseInt(hostPort), parseInt(containerPort));

        project.save();
    }

    @Command("port:remove <host-port>:<container-port>")
    public async removePort(
        @Param("host-port")
        hostPort: string,
        @Param("container-port")
        containerPort: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.unlinkPort(parseInt(hostPort), parseInt(containerPort));

        project.save();
    }

    @Command("port:clear")
    public async clearPorts(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(project.ports) {
            delete project.ports;

            project.save();
        }
    }

    @Command("config")
    public async configList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global?: boolean
    ): Promise<string> {
        let env: EnvConfig;

        if(!global) {
            const project = this.projectService.get(name);

            env = project.env || {};
        }
        else {
            const config = this.appConfigService.config;

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
        @Param("key")
        keys: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean
    ): Promise<string> {
        let config = global
            ? this.appConfigService.config
            : this.projectService.get(name);

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
    @Description("Setting env variables")
    public async configSet(
        @Param("configs")
        variables: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global: boolean
    ): Promise<void> {
        if(global) {
            for(const variable of variables) {
                const [key, value] = variable.split("=");

                if(!value) {
                    console.info(colors.yellow(`No value for "${key}"`));
                    continue;
                }

                this.appConfigService.config.setEnv(key.trim(), value.trim());
            }
            return;
        }

        const project = this.projectService.get(name);

        for(const variable of variables) {
            const [key, value] = variable.split("=");

            if(!value) {
                console.info(colors.yellow(`No value for "${key}"`));
                continue;
            }

            project.setEnv(key, value);
        }

        project.save();
    }

    @Command("config:unset [...configs]")
    public async configUnset(
        @Param("configs")
        configs: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global?: boolean
    ): Promise<void> {
        const env: Project["env"] = configs.reduce((env, config) => {
            const [key] = config.split("=");

            env[key.trim()] = null;

            return env;
        }, {});

        if(global) {
            return;
        }

        const project = this.projectService.get(name);

        for(const i in env) {
            project.unsetEnv(i);
        }

        project.save();
    }

    @Command("build-args")
    public async buildArgsList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

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
        @Param("buildArgs")
        args: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

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
        @Param("buildArgs")
        args: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        const buildArgs: Project["buildArgs"] = args.reduce((env, config) => {
            let [, key = "", value = ""] = config.split(/^([^=]+)=(.*)$/);

            key = key.trim();
            value = value.trim();

            if(key) {
                env[key] = value;
            }

            return env;
        }, {});

        for(const key in buildArgs) {
            if(!project.buildArgs) {
                project.buildArgs = {};
            }

            project.buildArgs[key] = buildArgs[key];
        }

        project.save();
    }

    @Command("build-args:unset [...buildArgs]")
    public async buildArgsUnset(
        @Param("buildArgs")
        args: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        const buildArgs: Project["buildArgs"] = args.reduce((env, config) => {
            let [, key = "", value = ""] = config.split(/^([^=]+)(?:=(.*))?$/);

            key = key.trim();
            value = value.trim();

            env[key] = value;

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

        project.save();
    }

    @Command("volumes")
    public async volumeList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

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
        @Param("volumes")
        volumes: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(Array.isArray(volumes) && volumes.length > 0) {
            project.volumeMount(...volumes)

            project.save();
        }
    }

    @Command("volume:unmount [...volumes]")
    public async volumeUnmount(
        @Param("volumes")
        volumes: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(Array.isArray(volumes) && volumes.length > 0) {
            project.volumeUnmount(...volumes);

            project.save();
        }
    }

    @Command("extra-hosts")
    @Description("List of extra hosts")
    public async extraHostList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

        if(!project.extraHosts) {
            return "No extra hosts found";
        }

        const table = new CliTable({
            head: ["Host", "Domain"]
        });

        for(const host in project.extraHosts) {
            table.push([
                host, project.extraHosts[host]
            ]);
        }

        return table.toString();
    }

    @Command("extra-host:add <extraHost>:<extraDomain>")
    @Description("Adding extra host")
    public async addExtraHost(
        @Param("extraHost")
        extraHost: string,
        @Param("extraDomain")
        extraDomain: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.addExtraHost(extraHost, extraDomain);

        project.save();
    }

    @Command("extra-host:remove <extraHost>")
    @Description("Removing extra host")
    public async removeExtraHost(
        @Param("extraHost")
        extraHost: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.removeExtraHost(extraHost);

        project.save();
    }

    @Command("attach")
    @Description("Attach local standard input, output, and error streams to a running container")
    public async attach(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.dockerService.attach(project.containerName);
    }

    // noinspection BadExpressionStatementJS
    @Command("run <script> [...args]")
    public async run(
        @Param("script")
        script: string,
        @Param("args")
        args?: string[],
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(!project.scripts || !project.scripts[script]) {
            throw new Error(`Script ${script} not found`);
        }

        const container = await this.dockerService.getContainer(project.containerName);

        if(!container) {
            throw new Error("The project is not started");
        }

        const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: process.stdin.isTTY,
            Cmd: ["bash", "-i", "-c", [project.scripts[script], ...args || []].join(" ")]
        });

        const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: process.stdin.isTTY
        });

        await this.dockerService.attachStream(stream);
    }

    @Command("logs")
    public async logs(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string,
        @Option("global", {
            type: "boolean",
            alias: "g"
        })
        global?: boolean,
        @Option("detach", {
            type: "boolean",
            alias: "d",
            description: "Detach"
        })
        detach?: boolean,
        @Option("follow", {
            type: "boolean",
            alias: "f"
        })
        follow?: boolean,
        @Option("clear", "c")
        clear?: boolean
    ): Promise<void> {
        if(global) {
            if(clear) {
                this.logService.clear();
            }

            const prepareLog = (str: string) => {
                return str.replace(/^\[.*]\s([^:]+):\s.*$/gm, (substring, type) => {
                    switch(type) {
                        case "debug":
                            return colors.gray(substring);

                        case "log":
                            return colors.white(substring);

                        case "info":
                            return colors.green(substring);

                        case "warn":
                        case "warning":
                            return colors.yellow(substring);

                        case "error":
                            return colors.red(substring);

                        default:
                            return substring;
                    }
                });
            };

            const file = this.appConfigService.fs.open("ws.log", "r");

            const stream = file.createReadlineStream({
                start: -10
            });

            stream.on("data", (line: string): void => {
                process.stdout.write(prepareLog(line));
                process.stdout.write("\n");
            });

            if(follow) {
                const stats = file.stat();

                const watcher = this.appConfigService.fs.watch("ws.log");
                const mutex = new Mutex();

                let position = stats.size;

                watcher.on("change", async () => {
                    await mutex.acquire();

                    try {
                        const stats = file.stat();

                        if(stats.size < position) {
                            console.info("file truncated");

                            position = 0;
                        }

                        const buffer = file.readBytes(position);

                        position += buffer.length;

                        process.stdout.write(prepareLog(buffer.toString("utf-8")));
                    }
                    finally {
                        mutex.release();
                    }
                });
            }
            return;
        }

        const project = this.projectService.get(name);

        await this.projectService.logs(project, detach);
    }
}
