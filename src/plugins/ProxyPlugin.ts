import chalk from "chalk";
import CliTable from "cli-table3";
import {Cli} from "@kearisp/cli";

import {Plugin, Docker, Logger} from "src/makes";
import {Project} from "src/models";
import {
    AppConfigService,
    AppEventsService,
    ProjectService
} from "src/services";
import {promptText, demuxOutput} from "src/utils";


type InitOptions = {
    "http-port"?: number;
    "https-port"?: number;
};

type DomainsOptions = {
    name?: string;
};

class ProxyPlugin extends Plugin {
    protected containerName = "proxy.workspace";

    public constructor(
        protected appConfigService: AppConfigService,
        protected appEventsService: AppEventsService,
        protected projectService: ProjectService
    ) {
        super("proxy");
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appEventsService.on("project:beforeStart", (project) => this.onProjectStart(project));

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

        cli.command("proxy:logs")
            .action(() => this.logs());

        cli.command("domains")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions) => this.domainList(options));

        cli.command("domain:add [...domains]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions, domains: string[]) => this.addDomain(options, domains));

        cli.command("domain:remove [...domains]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions, domains: string[]) => this.removeDomain(options, domains));

        cli.command("domain:set [...domains]")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .completion("name", () => this.getProjectNames())
            .action((options: DomainsOptions, domains: string[]) => this.setDomains(options, domains));

        cli.command("domain:clear")
            .option("name", {
                type: "string",
                alias: "n"
            })
            .action((options: DomainsOptions) => this.clearDomains(options));
    }

    public async getProjectNames() {
        const projects = await Project.search();

        return projects.map((project) => {
            return project.name;
        });
    }

    public async onProjectStart(project: Project) {
        await this.createNetwork();

        if(!project.getEnv("VIRTUAL_HOST")) {
            project.setEnv("VIRTUAL_HOST", `${project.name}.workspace`);
        }
    }

    public async createNetwork() {
        const networks = await Docker.docker.listNetworks();

        const workspaceNetwork = networks.find(network => network.Name === "workspace");

        if(!workspaceNetwork) {
            console.info("Creating \"workspace\" network.");

            await Docker.docker.createNetwork({
                Name: "workspace"
            });
        }
    }

    public async init(options: InitOptions) {
        let {
            "http-port": httpPort,
            "https-port": httpsPort
        } = options;

        Logger.log(typeof httpPort, typeof httpsPort);

        if(typeof httpPort === "undefined" || isNaN(httpPort)) {
            httpPort = await promptText({
                required: true,
                label: "Http port",
                type: "integer",
                default: await this.appConfigService.getEnvVariable("PROXY_HTTP_PORT", "80")
            });
        }

        await this.appConfigService.setEnvVariable("PROXY_HTTP_PORT", httpPort);

        if(typeof httpsPort === "undefined" || httpsPort === null) {
            httpsPort = await promptText({
                required: true,
                label: "Https port",
                type: "integer",
                default: await this.appConfigService.getEnvVariable("PROXY_HTTPS_PORT", "443")
            });
        }

        await this.appConfigService.setEnvVariable("PROXY_HTTPS_PORT", httpsPort);
    }

    public async start() {
        console.info("Proxy starting...");

        await Docker.pullImage("nginxproxy/nginx-proxy");

        const httpPort = await this.appConfigService.getEnvVariable("PROXY_HTTP_PORT", "80");
        const httpsPort = await this.appConfigService.getEnvVariable("PROXY_HTTPS_PORT", "443");

        const container = await Docker.createContainer({
            name: this.containerName,
            image: "nginxproxy/nginx-proxy",
            restart: "always",
            volumes: [
                "/var/run/docker.sock:/tmp/docker.sock:ro",
                `${this.certsPath()}:/etc/nginx/certs`
            ],
            ports: [
                `${httpPort}:${httpPort}`,
                `${httpsPort}:${httpsPort}`
            ],
            env: {
                DEFAULT_HOST: "index.workspace",
                HTTP_PORT: httpPort,
                HTTPS_PORT: httpsPort
            }
        });

        await container.start();
    }

    public async stop() {
        console.info("Proxy stopping...");

        const container  = await Docker.getContainer(this.containerName);

        if(container) {
            try {
                await container.stop();
            }
            catch(err) {
                //
            }

            try {
                await container.remove();
            }
            catch(err) {
                //
            }
        }
    }

    public async restart() {
        await this.stop();
        await this.start();
    }

    public async logs() {
        const container = await Docker.getContainer(this.containerName);

        if(container) {
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

    public async domainList(options: DomainsOptions) {
        const {
            name
        } = options;

        const project = await Project.searchOne(name ? {name} : {src: this.appConfigService.getPWD()});

        if(!project) {
            throw new Error("Project not found");
        }

        const table = new CliTable({
            head: [chalk.yellow("Domain")]
        });

        const domains =  project.getEnv("VIRTUAL_HOST", "").split(",");

        for(const domain of domains) {
            table.push([domain]);
        }

        return table.toString();
    }

    public async addDomain(options: DomainsOptions, addDomains: string[]) {
        const {
            name
        } = options;

        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        if(!project) {
            throw new Error("Project not found");
        }

        let domains = project.getEnv("VIRTUAL_HOST", "").split(",").filter((domain) => {
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

        const container = await Docker.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop();
            await this.projectService.start();
        }
    }

    public async removeDomain(options: DomainsOptions, removeDomains: string[]) {
        const {
            name
        } = options;

        const project = await Project.searchOne(name ? {name} : {src: this.appConfigService.getPWD()});

        if(!project) {
            throw new Error("Project not found");
        }

        let domains = project.getEnv("VIRTUAL_HOST", "").split(",").filter((domain) => {
            return !!domain;
        });

        domains = domains.filter((domain) => {
            return !removeDomains.find((removeDomain) => {
                return removeDomain === domain;
            });
        });

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        await project.save();
    }

    public async setDomains(options: DomainsOptions, domains: string[]) {
        const {
            name
        } = options;

        const project = await Project.searchOne(name ? {name} : {src: this.appConfigService.getPWD()});

        if(!project) {
            throw new Error("Project not found");
        }

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        await project.save();
    }

    public async clearDomains(options: DomainsOptions) {
        const {
            name
        } = options;

        const project = await Project.searchOne(name ? {name} : {src: this.appConfigService.getPWD()});

        if(!project) {
            throw new Error("Project not found");
        }

        project.unsetEnv("VIRTUAL_HOST");

        await project.save();
    }
}


export {ProxyPlugin};
