import {
    Injectable,
    Project,
    ProxyService as CoreProxyService
} from "@wocker/core";
import {promptInput} from "@wocker/utils";
import * as Path from "path";

import {PLUGINS_DIR} from "../env";
import {AppConfigService} from "./AppConfigService";
import {DockerService} from "./DockerService";


@Injectable("PROXY_SERVICE")
export class ProxyService extends CoreProxyService {
    protected containerName = "proxy.workspace";
    protected imageName = "wocker-proxy:1.0.1";
    protected oldImages = [
        "wocker-proxy:1.0.0"
    ];

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {
        super();
    }

    public async init(project: Project): Promise<void> {
        const appPort = await promptInput({
            message: "App port",
            type: "number",
            default: parseInt(project.getEnv("VIRTUAL_PORT", "80"))
        });

        project.setEnv("VIRTUAL_PORT", appPort.toString());

        await project.save();
    }

    public async start(restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop();
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            console.info("Proxy starting...");

            await this.build(rebuild);

            if(!this.appConfigService.fs.exists("certs/ca")) {
                this.appConfigService.fs.mkdir("certs/ca", {
                    recursive: true,
                    mode: 0o700
                });
            }

            if(!this.appConfigService.fs.exists("certs/projects")) {
                this.appConfigService.fs.mkdir("certs/projects", {
                    recursive: true,
                    mode: 0o700
                });
            }

            const config = this.appConfigService.config;

            const httpPort = config.getMeta("PROXY_HTTP_PORT", "80");
            const httpsPort = config.getMeta("PROXY_HTTPS_PORT", "443");
            const sshPort = config.getMeta("PROXY_SSH_PORT", "22");

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                restart: "always",
                env: {
                    DEFAULT_HOST: "localhost",
                    TRUST_DOWNSTREAM_PROXY: "true"
                },
                ports: [
                    `${httpPort}:80`,
                    `${httpsPort}:443`,
                    ...config.getMeta("PROXY_SSH_PASSWORD") ? [
                        `${sshPort}:22`
                    ] : []
                ],
                volumes: [
                    "/var/run/docker.sock:/tmp/docker.sock:ro",
                    `${this.appConfigService.fs.path("certs/projects")}:/etc/nginx/certs`,
                    `${this.appConfigService.fs.path("certs/ca")}:/etc/nginx/ca-certs`
                ],
                network: "workspace"
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

    public async build(rebuild?: boolean): Promise<void> {
        let exists = await this.dockerService.imageExists(this.imageName);

        if(rebuild && exists) {
            await this.dockerService.imageRm(this.imageName);

            exists = false;
        }

        if(exists) {
            return;
        }

        for(const oldImage of this.oldImages) {
            await this.dockerService.imageRm(oldImage);
        }

        const config = this.appConfigService.config;

        await this.dockerService.buildImage({
            tag: this.imageName,
            context: Path.join(PLUGINS_DIR, "proxy"),
            src: "./Dockerfile",
            buildArgs: {
                SSH_PASSWORD: config.getMeta("PROXY_SSH_PASSWORD")
            }
        });
    }

    public async logs(): Promise<void> {
        await this.dockerService.logs(this.containerName);
    }
}
