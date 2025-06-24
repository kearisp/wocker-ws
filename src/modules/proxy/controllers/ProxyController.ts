import {
    Command,
    Completion,
    Controller,
    Description,
    Option,
    Project,
    AppConfigService,
    EventService
} from "@wocker/core";
import {promptConfirm, promptInput} from "@wocker/utils";
import colors from "yoctocolors-cjs";
import {ProjectService} from "../../project";
import {ProxyService} from "../services/ProxyService";


@Controller()
@Description("Proxy commands")
export class ProxyController {
    protected containerName = "proxy.workspace";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly eventService: EventService,
        protected readonly projectService: ProjectService,
        protected readonly proxyService: ProxyService
    ) {
        this.eventService.on("project:init", (project: Project): Promise<void> => this.proxyService.init(project));
        this.eventService.on("project:start", (project: Project): Promise<void> => this.onProjectStart(project));
        this.eventService.on("project:stop", (project: Project): Promise<void> => this.onProjectStop(project));
    }

    public async onProjectStart(project: Project): Promise<void> {
        if(project.domains.length === 0) {
            return;
        }

        console.info(colors.green("Don't forget to add these lines into hosts file:"));

        for(const domain of project.domains) {
            console.info(colors.gray(`127.0.0.1 ${domain}`));
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
    @Description("Initializes proxy configurations")
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
        httpsPort?: number,
        @Option("ssh-port", {
            type: "number",
            description: "SSH port"
        })
        sshPort?: number,
        @Option("ssh-password", {
            type: "string",
            description: "SSH password"
        })
        sshPassword?: string
    ): Promise<void> {
        const config = this.appConfigService.config;

        if(httpPort === null || typeof httpPort === "undefined" || isNaN(httpPort)) {
            httpPort = await promptInput({
                required: true,
                message: "Http port",
                type: "number",
                default: parseInt(config.getMeta("PROXY_HTTP_PORT", "80"))
            });
        }

        config.setMeta("PROXY_HTTP_PORT", httpPort.toString());

        if(httpsPort === null || typeof httpsPort === "undefined" || isNaN(httpsPort)) {
            httpsPort = await promptInput({
                required: true,
                message: "Https port",
                type: "number",
                default: parseInt(config.getMeta("PROXY_HTTPS_PORT", "443"))
            });
        }

        config.setMeta("PROXY_HTTPS_PORT", httpsPort.toString());

        let enableSsh = !sshPassword && !sshPort
            ? await promptConfirm({
                message: "Enable ssh proxy?",
                default: false
            })
            : true;

        if(enableSsh) {
            if(!sshPassword) {
                sshPassword = await promptInput({
                    message: "SSH Password",
                    type: "password",
                    required: true,
                    default: config.getMeta("PROXY_SSH_PASSWORD")
                });
            }

            if(!sshPort) {
                sshPort = await promptInput({
                    message: "SSH port",
                    type: "number",
                    default: parseInt(config.getMeta("PROXY_SSH_PORT", "22"))
                });
            }

            config.setMeta("PROXY_SSH_PASSWORD", sshPassword);
            config.setMeta("PROXY_SSH_PORT", sshPort.toString());
        }
        else {
            config.unsetMeta("PROXY_SSH_PASSWORD");
            config.unsetMeta("PROXY_SSH_PORT");
        }

        this.appConfigService.save();
    }

    @Command("proxy:start")
    @Description("This command starts the proxy for the project. Options are available to restart or rebuild the proxy if needed.")
    public async start(
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restarts the proxy before starting it"
        })
        restart?: boolean,
        @Option("rebuild", {
            type: "boolean",
            alias: "b",
            description: "Rebuilds the proxy before starting it"
        })
        rebuild?: boolean
    ): Promise<void> {
        await this.proxyService.start(restart, rebuild);
    }

    @Command("proxy:stop")
    @Description("This command stops the currently running proxy for the project. It ensures that all proxy-related services are properly halted.")
    public async stop(): Promise<void> {
        console.info("Proxy stopping...");

        await this.proxyService.stop();
    }

    @Command("proxy:logs")
    @Description("Displays the proxy logs")
    public async logs(): Promise<void> {
        await this.proxyService.logs();
    }
}
