import {
    Injectable,
    Project,
    AppService,
    AppFileSystemService,
    ProcessService,
    ProxyService as CoreProxyService
} from "@wocker/core";
import {DockerService} from "@wocker/docker-module";
import {promptInput} from "@wocker/utils";
import * as Path from "path";
import {PLUGINS_DIR} from "../../../env";


@Injectable("PROXY_SERVICE")
export class ProxyService extends CoreProxyService {
    protected containerName = "wocker-proxy";
    protected oldContainerNames = ["proxy.workspace"];
    protected imageName = "wocker-proxy:1.0.2";
    protected oldImages = [
        "wocker-proxy:1.0.0",
        "wocker-proxy:1.0.1"
    ];

    public constructor(
        protected readonly appService: AppService,
        protected readonly processService: ProcessService,
        protected readonly fs: AppFileSystemService,
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
        project.save();
    }

    public async start(restart?: boolean, rebuild?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop();
        }

        let container = await this.dockerService.getContainer(this.containerName);

        if(!container) {
            for(const containerName of this.oldContainerNames) {
                await this.dockerService.removeContainer(containerName);
            }

            console.info("Proxy starting...");

            await this.build(rebuild);

            if(!this.fs.exists("certs/ca")) {
                this.fs.mkdir("certs/ca", {
                    recursive: true,
                    mode: 0o700
                });
            }

            if(!this.fs.exists("certs/projects")) {
                this.fs.mkdir("certs/projects", {
                    recursive: true,
                    mode: 0o700
                });
            }

            if(!this.fs.exists("nginx/vhost.d")) {
                this.fs.mkdir("nginx/vhost.d", {
                    recursive: true,
                    mode: 0o700
                });
            }

            if(!this.fs.exists("nginx/htpasswd")) {
                this.fs.mkdir("nginx/htpasswd", {
                    recursive: true,
                    mode: 0o764
                });
            }
            else {
                this.fs.chmod("nginx/htpasswd", 0o764);
            }

            const httpPort = this.appService.getMeta("PROXY_HTTP_PORT", "80"),
                  httpsPort = this.appService.getMeta("PROXY_HTTPS_PORT", "443"),
                  sshPort = this.appService.getMeta("PROXY_SSH_PORT", "22");

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                restart: "always",
                env: {
                    UID: this.processService.UID,
                    GID: this.processService.GID,
                    DEFAULT_HOST: "localhost",
                    TRUST_DOWNSTREAM_PROXY: "true"
                },
                ports: [
                    `${httpPort}:80`,
                    `${httpsPort}:443`,
                    ...this.appService.getMeta("PROXY_SSH_PASSWORD") ? [
                        `${sshPort}:22`
                    ] : []
                ],
                volumes: [
                    "/var/run/docker.sock:/tmp/docker.sock:ro",
                    `${this.fs.path("certs/projects")}:/etc/nginx/certs`,
                    `${this.fs.path("certs/ca")}:/etc/nginx/ca-certs`,
                    `${this.fs.path("nginx/vhost.d")}:/etc/nginx/vhost.d`,
                    `${this.fs.path("nginx/htpasswd")}:/etc/nginx/htpasswd`
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

        await this.dockerService.buildImage({
            tag: this.imageName,
            version: this.appService.isExperimentalEnabled("buildKit") ? "2" : "1",
            buildArgs: {
                SSH_PASSWORD: this.appService.getMeta("PROXY_SSH_PASSWORD")
            },
            context: Path.join(PLUGINS_DIR, "proxy"),
            dockerfile: "./Dockerfile"
        });
    }

    public async logs(): Promise<void> {
        await this.dockerService.logs(this.containerName);
    }
}
