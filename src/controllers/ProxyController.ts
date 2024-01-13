import {
    DI,
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService,
    Controller,
    Cli,
    Project
} from "@wocker/core";
import {promptText} from "@wocker/utils";
import CliTable from "cli-table3";
import chalk from "chalk";

import {FS} from "src/makes";
import {demuxOutput} from "src/utils";


type InitOptions = {
    "http-port"?: number;
    "https-port"?: number;
};

type DomainsOptions = {
    name?: string;
};

class ProxyController extends Controller {
    protected containerName = "proxy.workspace";
    protected appConfigService: AppConfigService;
    protected appEventsService: AppEventsService;
    protected projectService: ProjectService;
    protected dockerService: DockerService;

    public constructor(di: DI) {
        super();

        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
        this.appEventsService = di.resolveService<AppEventsService>(AppEventsService);
        this.projectService = di.resolveService<ProjectService>(ProjectService);
        this.dockerService = di.resolveService<DockerService>(DockerService);
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appEventsService.on("project:beforeStart", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));

        cli.command("proxy:init")
            .option("http-port", {
                type: "number",
                description: "Http port"
            })
            .option("https-port", {
                type: "number",
                description: "Https port"
            })
            .action((options: InitOptions) => this.init(options));

        cli.command("proxy:start")
            .action(() => this.start());

        cli.command("proxy:stop")
            .action(() => this.stop());

        cli.command("proxy:restart")
            .action(() => this.restart());

        cli.command("domains")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .action((options: DomainsOptions) => this.domainList(options));

        cli.command("domain:set [...domains]")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions, domains: string[]) => this.setDomains(options, domains));

        cli.command("domain:add [...domains]")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions, domains: string[]) => this.addDomain(options, domains));

        cli.command("domain:remove [...domains]")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .completion("name", () => this.getProjectNames())
            .completion("domains", (options: DomainsOptions, domains) => this.getDomains(options.name, domains as string[]))
            .action((options: DomainsOptions, domains: string[]) => this.removeDomain(options, domains));

        cli.command("domain:clear")
            .option("name", {
                type: "string",
                alias: "n",
                description: "Project name"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions) => this.clearDomains(options));

        cli.command("proxy:logs")
            .action(() => this.logs());
    }

    public async getProjectNames() {
        const projects = await Project.search();

        return projects.map((project) => project.name);
    }

    public async getDomains(name: string | undefined, selected: string[]) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        return (project.getEnv("VIRTUAL_HOST") || "").split(",").filter((domain: string) => {
            return !selected.includes(domain);
        });
    }

    public async onProjectStart(project: Project) {
        if(!project.hasEnv("VIRTUAL_HOST")) {
            project.setEnv("VIRTUAL_HOST", `${project.name}.workspace`);
        }

        await this.start();
    }

    public async onProjectStop(project: Project) {
        //
    }

    public async init(options: InitOptions) {
        let {
            "http-port": httpPort,
            "https-port": httpsPort
        } = options;

        if(typeof httpPort === "undefined" || isNaN(httpPort)) {
            httpPort = await promptText({
                required: true,
                message: "Http port:",
                type: "int",
                default: await this.appConfigService.getEnvVariable("PROXY_HTTP_PORT", "80")
            });
        }

        await this.appConfigService.setEnvVariable("PROXY_HTTP_PORT", httpPort);

        if(typeof httpsPort === "undefined" || isNaN(httpsPort)) {
            httpsPort = await promptText({
                required: true,
                message: "Https port:",
                type: "int",
                default: await this.appConfigService.getEnvVariable("PROXY_HTTPS_PORT", "443")
            });
        }

        await this.appConfigService.setEnvVariable("PROXY_HTTPS_PORT", httpsPort);
    }

    public async start() {
        console.info("Proxy starting...");

        await this.dockerService.pullImage("nginxproxy/nginx-proxy");

        const httpPort = await this.appConfigService.getEnvVariable("PROXY_HTTP_PORT", "80");
        const httpsPort = await this.appConfigService.getEnvVariable("PROXY_HTTPS_PORT", "443");

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            const certsDir = this.appConfigService.dataPath("certs");

            if(!FS.existsSync(certsDir)) {
                FS.mkdirSync(certsDir, {
                    recursive: true
                });
            }

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: "nginxproxy/nginx-proxy",
                volumes: [
                    "/var/run/docker.sock:/tmp/docker.sock:ro",
                    `${certsDir}:/etc/nginx/certs`
                ],
                ports: [
                    `${httpPort}:80`,
                    `${httpsPort}:443`
                ],
                env: {
                    DEFAULT_HOST: "index.workspace"
                }
            });
        }
        else {
            console.info("Container already exists");
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(["created", "exited"].includes(Status)) {
            console.info("Starting...", Status)

            await container.start();
        }
    }

    public async stop() {
        console.info("Proxy stopping...");

        await this.dockerService.removeContainer(this.containerName);
    }

    public async restart() {
        await this.stop();
        await this.start();
    }

    public async domainList(options: DomainsOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        const table = new CliTable({
            head: [chalk.yellow("Domain")]
        });

        const domains = project.getEnv("VIRTUAL_HOST", "").split(",");

        for(const domain of domains) {
            table.push([domain]);
        }

        return table.toString() + "\n";
    }

    public async setDomains(options: DomainsOptions, domains: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        project.save();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop(project);
            await this.projectService.start(project);
        }
    }

    public async addDomain(options: DomainsOptions, addDomains: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        let domains = project.getEnv("VIRTUAL_HOST", "").split(",").filter((domain: string) => {
            return !!domain;
        });

        domains = [
            ...domains,
            ...addDomains.filter((domain) => {
                return !domains.find((existDomain) => {
                    return existDomain === domain;
                });
            })
        ];

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        await project.save();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop(project);
            await this.projectService.start(project);
        }
    }

    public async removeDomain(options: DomainsOptions, removeDomains: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        let domains = project.getEnv("VIRTUAL_HOST", "").split(",").filter((domain: string) => {
            return !!domain;
        });

        domains = domains.filter((domain) => {
            return !removeDomains.includes(domain);
        });

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        await project.save();
    }

    public async clearDomains(options: DomainsOptions) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.unsetEnv("VIRTUAL_HOST");

        await project.save();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop(project);
            await this.projectService.start(project);
        }
    }

    public async logs() {
        const container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            return;
        }

        const stream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true
        });

        stream.on("data", (data) => {
            process.stdout.write(demuxOutput(data));
        });
    }
}


export {ProxyController};
