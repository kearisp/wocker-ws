import {
    Command,
    Completion,
    Controller,
    Option,
    Project
} from "@wocker/core";
import {promptText} from "@wocker/utils";
import chalk from "chalk";

import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    ProxyService
} from "../services";


@Controller()
export class ProxyController {
    protected containerName = "proxy.workspace";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly proxyService: ProxyService
    ) {
        this.appEventsService.on("project:init", (project: Project): Promise<void> => this.proxyService.init(project));
        this.appEventsService.on("project:start", (project: Project): Promise<void> => this.onProjectStart(project));
        this.appEventsService.on("project:stop", (project: Project): Promise<void> => this.onProjectStop(project));
    }

    public async onProjectStart(project: Project): Promise<void> {
        if(project.domains.length === 0) {
            return;
        }

        console.info(chalk.green("Don't forget to add these lines into hosts file:"));

        for(const domain of project.domains) {
            console.info(chalk.gray(`127.0.0.1 ${domain}`));
        }

        await this.start();
    }

    public async onProjectStop(project: Project): Promise<void> {
        // TODO: Stop proxy if no containers needed
    }

    @Completion("name")
    public getProjectNames(): string[] {
        const projects = this.projectService.search();

        return projects.map((project) => project.name);
    }

    @Command("proxy:init")
    public async init(
        @Option("http-port", {
            type: "number",
            description: "Http port"
        })
        httpPort?: number,
        @Option("https-port", {
            type: "number",
            description: "Https port"
        })
        httpsPort?: number
    ): Promise<void> {
        const config = this.appConfigService.getConfig();

        if(httpPort === null || typeof httpPort === "undefined" || isNaN(httpPort)) {
            httpPort = await promptText({
                required: true,
                message: "Http port:",
                type: "number",
                default: config.getMeta("PROXY_HTTP_PORT", "80")
            });
        }

        config.setMeta("PROXY_HTTP_PORT", httpPort.toString());

        if(httpsPort === null || typeof httpsPort === "undefined" || isNaN(httpsPort)) {
            httpsPort = await promptText({
                required: true,
                message: "Https port:",
                type: "number",
                default: config.getMeta("PROXY_HTTPS_PORT", "443")
            });
        }

        config.setMeta("PROXY_HTTPS_PORT", httpsPort.toString());

        await config.save();
    }

    @Command("proxy:start")
    public async start(
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart"
        })
        restart?: boolean,
        @Option("rebuild", {
            type: "boolean",
            alias: "b",
            description: "Rebuild"
        })
        rebuild?: boolean
    ): Promise<void> {
        await this.proxyService.start(restart, rebuild);
    }

    @Command("proxy:stop")
    public async stop(): Promise<void> {
        console.info("Proxy stopping...");

        await this.proxyService.stop();
    }

    @Command("proxy:gen")
    public async gen(): Promise<void> {
        await this.proxyService.gen();
    }

    @Command("proxy:logs")
    public async logs(): Promise<void> {
        await this.proxyService.logs();
    }
}
