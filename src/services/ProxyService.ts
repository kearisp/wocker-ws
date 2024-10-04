import {Injectable, Project} from "@wocker/core";
import {promptText} from "@wocker/utils";

import {FS} from "../makes";
import {AppConfigService} from "./AppConfigService";
import {DockerService} from "./DockerService";


@Injectable("PROXY_SERVICE")
export class ProxyService {
    protected containerName = "proxy.workspace";
    protected imageName = "nginxproxy/nginx-proxy";

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public async init(project: Project): Promise<void> {
        const appPort = await promptText({
            message: "App port:",
            type: "number",
            default: project.getEnv("VIRTUAL_PORT", "80")
        });

        project.setEnv("VIRTUAL_PORT", appPort);

        await project.save();
    }

    public async start(restart?: boolean): Promise<void> {
        if(restart) {
            await this.stop();
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            console.info("Proxy starting...");

            await this.dockerService.pullImage(this.imageName);

            const certsDir = this.appConfigService.dataPath("certs");

            if(!FS.existsSync(certsDir)) {
                FS.mkdirSync(certsDir, {
                    recursive: true,
                    mode: 0o700
                });
            }

            const config = this.appConfigService.getConfig();

            const httpPort = config.getMeta("PROXY_HTTP_PORT", "80");
            const httpsPort = config.getMeta("PROXY_HTTPS_PORT", "443");

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
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
            await container.start();

            console.info("Proxy started");
        }
    }

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }

    public async logs(): Promise<void> {
        await this.dockerService.logs(this.containerName);
    }
}
