import {
    Controller,
    Command,
    Description,
    Option,
    FileSystemManager,
    AppConfigService,
    DockerService
} from "@wocker/core";
import * as Path from "path";


@Controller()
export class ProxmoxController {
    protected configDir: string;
    protected containerName: string = "proxmox.workspace";
    protected imageName: string = "wocker-proxmox:1.0.0";
    protected fs: FileSystemManager;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {
        this.configDir = this.appConfigService.dataPath("plugins/proxmox");
    }

    public pluginPath(...parts: string[]) {
        return Path.join(this.appConfigService.pluginsPath("proxmox"), ...parts);
    }

    @Command("proxmox:start")
    @Description("Starting proxmox")
    public async start(
        @Option("restart", {
            alias: "r"
        })
        restart?: boolean,
        @Option("rebuild", {
            alias: "b"
        })
        rebuild?: boolean
    ): Promise<void> {
        if(restart || rebuild) {
            await this.dockerService.removeContainer(this.containerName);
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            await this.build(rebuild);

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                env: {
                    VIRTUAL_HOST: this.containerName,
                    VIRTUAL_PORT: "8006"
                }
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    @Command("proxmox:stop")
    @Description("Stopping proxmox")
    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }

    protected async build(rebuild?: boolean): Promise<void> {
        if(rebuild) {
            await this.dockerService.imageRm(this.imageName);
        }
        else {
            if(await this.dockerService.imageExists(this.imageName)) {
                return;
            }
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: this.pluginPath(),
            src: "./Dockerfile"
        });
    }
}
