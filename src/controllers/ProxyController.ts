import {
    Command,
    Completion,
    Controller,
    Option,
    Project
} from "@wocker/core";
import {promptText, demuxOutput} from "@wocker/utils";
import CliTable from "cli-table3";
import chalk from "chalk";

import {FS} from "../makes";
import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    DockerService
} from "../services";


@Controller()
export class ProxyController {
    protected containerName = "proxy.workspace";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly dockerService: DockerService
    ) {
        this.appEventsService.on("project:beforeStart", (project: Project) => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project) => this.onProjectStop(project));
    }

    public async onProjectStart(project: Project) {
        if(!project.hasEnv("VIRTUAL_HOST")) {
            project.setEnv("VIRTUAL_HOST", project.containerName);
        }

        await this.start();
    }

    public async onProjectStop(project: Project) {
        //
    }

    @Completion("name")
    public async getProjectNames() {
        const projects = await this.projectService.search();

        return projects.map((project) => project.name);
    }

    @Command("domains")
    public async getDomains(name: string | undefined, selected: string[]) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        return (project.getEnv("VIRTUAL_HOST") || "").split(",").filter((domain: string) => {
            return !selected.includes(domain);
        });
    }

    @Command("proxy:init")
    public async init(
        @Option("http-port", {
            type: "number",
            description: "Http port"
        })
        httpPort: number,
        @Option("https-port", {
            type: "number",
            description: "Https port"
        })
        httpsPort: number
    ) {
        const config = await this.appConfigService.getConfig();

        if(typeof httpPort === "undefined" || isNaN(httpPort)) {
            httpPort = await promptText({
                required: true,
                message: "Http port:",
                type: "int",
                default: config.getMeta("PROXY_HTTP_PORT", "80")
            });
        }

        config.setMeta("PROXY_HTTP_PORT", httpPort.toString());

        if(typeof httpsPort === "undefined" || isNaN(httpsPort)) {
            httpsPort = await promptText({
                required: true,
                message: "Https port:",
                type: "int",
                default: config.getMeta("PROXY_HTTPS_PORT", "443")
            });
        }

        config.setMeta("PROXY_HTTPS_PORT", httpsPort.toString());

        await config.save();
    }

    @Command("proxy:start")
    public async start() {
        console.info("Proxy starting...");

        const config = await this.appConfigService.getConfig();

        await this.dockerService.pullImage("nginxproxy/nginx-proxy");

        const httpPort = config.getMeta("PROXY_HTTP_PORT", "80");
        const httpsPort = config.getMeta("PROXY_HTTPS_PORT", "443");

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
                restart: "always",
                env: {
                    DEFAULT_HOST: "index.workspace"
                },
                ports: [
                    `${httpPort}:80`,
                    `${httpsPort}:443`
                ],
                volumes: [
                    "/var/run/docker.sock:/tmp/docker.sock:ro",
                    `${certsDir}:/etc/nginx/certs`
                ]
            });
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

    @Command("proxy:stop")
    public async stop() {
        console.info("Proxy stopping...");

        await this.dockerService.removeContainer(this.containerName);
    }

    @Command("proxy:restart")
    public async restart() {
        await this.stop();
        await this.start();
    }

    @Command("domains")
    public async domainList(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string
    ) {
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

    @Command("domain:set [...domains]")
    public async setDomains(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        domains: string[]
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.setEnv("VIRTUAL_HOST", domains.join(","));

        await project.save();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop();
            await this.projectService.start();
        }
    }

    @Command("domain:add [...domains]")
    public async addDomain(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        addDomains: string[]
    ) {
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
            await this.projectService.stop();
            await this.projectService.start();
        }
    }

    @Command("domain:remove [...domains]")
    public async removeDomain(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string,
        removeDomains: string[]
    ) {
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

    @Command("domain:clear")
    public async clearDomains(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name: string
    ) {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();

        project.unsetEnv("VIRTUAL_HOST");

        await project.save();

        const container = await this.dockerService.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.projectService.stop();
            await this.projectService.start();
        }
    }

    @Command("proxy:logs")
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
