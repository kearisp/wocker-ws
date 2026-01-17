import {
    Controller,
    Command,
    Description,
    Option,
    Param,
    AppConfigService,
    AppFileSystemService,
    FileSystemManager,
    ProcessService,
    ProjectType,
    EventService,
    FileSystem,
    Project,
    Completion,
    LogService,
    PROJECT_TYPE_IMAGE,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_PRESET,
    PROJECT_TYPE_COMPOSE
} from "@wocker/core";
import {DockerService} from "@wocker/docker-module";
import {promptConfirm, promptSelect, promptInput} from "@wocker/utils";
import Path from "path";
import CliTable from "cli-table3";
import colors from "yoctocolors-cjs";
import {Mutex} from "async-mutex";
import {PresetService} from "../../preset";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Project commands")
export class ProjectController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly fs: AppFileSystemService,
        protected readonly processService: ProcessService,
        protected readonly projectService: ProjectService,
        protected readonly presetService: PresetService,
        protected readonly eventService: EventService,
        protected readonly dockerService: DockerService,
        protected readonly logService: LogService
    ) {}

    @Completion("name")
    protected async getProjectNames(): Promise<string[]> {
        const projects = this.projectService.search();

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
        @Option("name", "n")
        @Description("The name of the project")
        name: string,
        @Option("type", "t")
        @Description("The type of the project")
        type: ProjectType
    ): Promise<void> {
        const fs = new FileSystem(this.processService.pwd());

        let project = this.projectService.searchOne({
            path: fs.path()
        });

        if(!project) {
            project = new Project({
                type: PROJECT_TYPE_IMAGE,
                name: fs.basename(),
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

                    const otherProject = this.projectService.searchOne({
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
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.stop(project);

        this.appConfigService.removeProject(project.name);
        this.appConfigService.save();
        this.fs.rm(`projects/${project.name}`, {
            recursive: true
        });
    }

    @Command("start")
    @Description("Starting project")
    public async start(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("restart", "r")
        @Description("Restarting project")
        restart?: boolean,
        @Option("build", "b")
        @Description("Build")
        build?: boolean,
        @Option("attach", "a")
        @Description("Attach")
        attach?: boolean
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.start(project, restart, build, attach);
    }

    @Command("stop")
    @Description("Stopping project")
    public async stop(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.stop(project);
    }

    @Command("ps")
    @Description("Projects list")
    public async projectList(
        @Option("all", "a")
        @Description("All projects")
        all: boolean
    ): Promise<string> {
        const table = new CliTable({
            head: ["Name", "Type", "Path", "Status"],
            colAligns: ["left", "center", "left", "center"]
        });

        const projects = this.projectService.search();

        for(const project of projects) {
            const container = await this.dockerService.getContainer(project.containerName);

            if(!container) {
                if(all) {
                    table.push([project.name, project.type, project.path, "-"]);
                }

                continue;
            }

            const {
                State: {
                    Status= "stopped"
                } = {}
            } = await container.inspect();

            table.push([project.name, project.type, project.path, Status]);
        }

        return table.toString();
    }

    @Command("build-args")
    @Description("Show build args of the project")
    public async buildArgsList(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
    ): Promise<string> {
        const project = this.projectService.get(name);

        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        for(const key in project.buildArgs) {
            table.push([
                key,
                typeof project.buildArgs[key] === "string"
                    ? project.buildArgs[key]
                    : JSON.stringify(project.buildArgs[key])
            ]);
        }

        for(const serviceName in project.services) {
            if(service && service !== serviceName) {
                continue;
            }

            if(!project.services[serviceName].buildArgs) {
                continue;
            }

            for(const key in project.services[serviceName].buildArgs) {
                table.options.head = ["KEY", "VALUE", "SERVICE"];

                table.push([
                    key,
                    project.services[serviceName].buildArgs[key],
                    serviceName
                ]);
            }
        }

        if(table.length === 0) {
            return colors.gray("No build args found!");
        }

        return table.toString();
    }

    @Command("build-args:get [...buildArgs]")
    @Description("Get build args")
    public async buildArgsGet(
        @Param("buildArgs")
        args: string[],
        @Option("name", "n")
        @Description("The name of the project")
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
    @Description("Set build args for the project")
    public async buildArgsSet(
        @Param("buildArgs")
        args: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
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
            project.setBuildArg(key, buildArgs[key], service);
        }

        project.save();
    }

    @Command("build-args:unset [...buildArgs]")
    @Description("Remove build args for the project")
    public async buildArgsUnset(
        @Param("buildArgs")
        args: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
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
            project.unsetBuildArg(key, service);
        }

        project.save();
    }

    @Command("domains")
    @Description("Project domain list")
    public async domains(
        @Option("name", "n")
        @Description("The name of the project")
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
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
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
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
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
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
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
        @Option("name", "n")
        @Description("The name of the project")
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
    @Description("List of ports")
    public async ports(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        service?: string
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
    @Description("Add port")
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
    @Description("Remove port")
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
    @Description("Clear ports")
    public async clearPorts(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(project.ports) {
            delete project.ports;

            project.save();
        }
    }

    @Command("config")
    @Description("List of environment variables")
    public async configList(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("global", "g")
        global?: boolean,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
    ): Promise<string> {
        const table = new CliTable({
            head: ["KEY", "VALUE"]
        });

        if(global) {
            for(const i in this.appConfigService.config.env) {
                table.push([
                    i,
                    this.appConfigService.config.env[i]
                ]);
            }
        }
        else {
            const project = this.projectService.get(name);

            for(const key in project.env) {
                table.push([
                    key,
                    project.env[key]
                ]);
            }

            for(const serviceName in project.services) {
                if(service && service !== serviceName) {
                    continue;
                }

                if(!project.services[serviceName].env) {
                    continue;
                }

                for(const key in project.services[serviceName].env) {
                    table.options.head = ["KEY", "NAME", "SERVICE"];

                    table.push([
                        key,
                        project.services[serviceName].env[key],
                        serviceName
                    ]);
                }
            }
        }

        if(table.length === 0) {
            return colors.gray("No environment variables found.");
        }

        return table.toString();
    }

    @Command("config:get [...key]")
    @Description("Get environment variable")
    public async configGet(
        @Param("key")
        keys: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name: string,
        @Option("global", "g")
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
        @Option("global", "g")
        global: boolean,
        @Option("name", "n")
        @Description("The name of the project")
        name: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
    ): Promise<void> {
        if(global) {
            for(const variable of variables) {
                const [key, value] = variable.split("=");

                if(!value) {
                    console.info(colors.yellow(`No value for "${key}"`));
                    continue;
                }

                this.appConfigService.setEnv(key.trim(), value.trim());
            }

            this.appConfigService.save();
            return;
        }

        const project = this.projectService.get(name);

        for(const variable of variables) {
            const [key, value] = variable.split("=");

            if(!value) {
                console.info(colors.yellow(`No value for "${key}"`));
                continue;
            }

            project.setEnv(key, value, service);
        }

        project.save();
    }

    @Command("config:unset [...configs]")
    @Description("Unset environment variable")
    public async configUnset(
        @Param("configs")
        configs: string[],
        @Option("global", "g")
        global?: boolean,
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
    ): Promise<void> {
        const env: Project["env"] = configs.reduce((env, config) => {
            const [key] = config.split("=");

            env[key.trim()] = null;

            return env;
        }, {});

        if(global) {
            for(const i in env) {
                this.appConfigService.unsetEnv(i);
            }

            this.appConfigService.save();

            return;
        }

        const project = this.projectService.get(name);

        for(const i in env) {
            project.unsetEnv(i, service);
        }

        project.save();
    }

    @Command("volumes")
    @Description("List of volumes")
    public async volumeList(
        @Option("name", "n")
        @Description("The name of the project")
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
    @Description("Mount volume")
    public async volumeMount(
        @Param("volumes")
        volumes: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        if(Array.isArray(volumes) && volumes.length > 0) {
            project.volumeMount(...volumes)

            project.save();
        }
    }

    @Command("volume:unmount [...volumes]")
    @Description("Unmount volume")
    public async volumeUnmount(
        @Param("volumes")
        volumes: string[],
        @Option("name", "n")
        @Description("The name of the project")
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
        @Option("name", "n")
        @Description("The name of the project")
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
        @Option("name", "n")
        @Description("The name of the project")
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
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        project.removeExtraHost(extraHost);

        project.save();
    }

    @Command("preset:eject")
    @Description("Eject preset files into the project")
    public async eject(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);
        const preset = this.presetService.get(project.preset);

        if(!preset) {
            throw new Error("Preset not found");
        }

        const confirm = await promptConfirm({
            message: "Confirm eject",
            default: false
        });

        if(!confirm) {
            return;
        }

        const copier = new FileSystemManager(
            preset.path,
            this.processService.pwd()
        );

        if(preset.dockerfile) {
            if(!copier.destination.exists(preset.dockerfile)) {
                copier.copy(preset.dockerfile);
            }

            project.type = "dockerfile";
            project.dockerfile = preset.dockerfile;
        }

        const files = copier.source.readdir("", {
            recursive: true
        });

        for(const path of files) {
            const stat = copier.source.stat(path),
                  dir = Path.dirname(path);

            if(stat.isFile() && path === "config.json") {
                continue;
            }

            if(stat.isFile() && path === preset.dockerfile) {
                continue;
            }

            if(copier.destination.exists(path)) {
                continue;
            }

            if(!copier.destination.exists(dir)) {
                copier.destination.mkdir(dir, {
                    recursive: true
                } as any);
            }

            copier.copy(path);
        }

        delete project.preset;
        delete project.imageName;

        project.save();
    }

    @Command("attach")
    @Description("Attach local standard input, output, and error streams to a running container")
    public async attach(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.attach(project);
    }

    // noinspection BadExpressionStatementJS
    @Command("run <script> [...args]")
    @Description("Run script")
    public async run(
        @Param("script")
        script: string,
        @Param("args")
        args: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("service", "s")
        @Description("The name of the service")
        service?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.run(project, script, service, args);
    }

    @Command("exec [...command]")
    @Description("Execute command")
    public async exec(
        @Param("command")
        command?: string[],
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.exec(project, command);
    }

    @Command("logs")
    @Description("Logs")
    public async logs(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("global", "g")
        @Description("Global")
        global?: boolean,
        @Option("detach", "d")
        @Description("Detach")
        detach?: boolean,
        @Option("follow", "f")
        @Description("Follow")
        follow?: boolean,
        @Option("clear", "c")
        @Description("Clear log file (works only with --global)")
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

            const file = this.fs.open("ws.log", "r");

            const stream = file.createReadlineStream({
                start: -10
            });

            stream.on("data", (line: string): void => {
                process.stdout.write(prepareLog(line));
                process.stdout.write("\n");
            });

            if(follow) {
                const stats = file.stat();

                const watcher = this.fs.watch("ws.log");
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
