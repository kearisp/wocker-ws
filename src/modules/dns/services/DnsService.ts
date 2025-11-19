import {Injectable, FileSystem} from "@wocker/core";
import {DockerService} from "@wocker/docker-module";
import Path from "path";
import {ROOT_DIR} from "../../../env";


@Injectable()
export class DnsService {
    protected imageName = "wocker-dns:0.0.1";
    protected containerName = "wocker-dns";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async start(restart?: boolean, rebuild?: boolean): Promise<void> {
        console.info("Starting DNS service...");
        console.info("DNS service currently isn't working");

        if(restart || rebuild) {
            await this.dockerService.removeContainer(this.containerName);
        }

        await this.build(rebuild);

        let container = await this.dockerService.getContainer(this.containerName);

        const fs = new FileSystem(`${ROOT_DIR}/plugins/dns`);

        if(!fs.exists("etc/dnsmasq.conf")) {
            fs.writeFile("etc/dnsmasq.conf", "");
        }

        if(!container) {
            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: this.imageName,
                volumes: [
                    "/var/run/docker.sock.raw:/var/run/docker.sock:ro",
                    "/var/run/docker.sock.raw:/tmp/docker.sock:ro",
                    `${fs.path("app/Procfile")}:/app/Procfile`,
                    `${fs.path("app/dnsmasq.conf.tmpl")}:/app/dnsmasq.conf.tmpl`,
                    `${fs.path("etc/dnsmasq.conf")}:/etc/dnsmasq.conf`
                ]
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

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }

    public async build(rebuild?: boolean): Promise<void> {
        if(await this.dockerService.imageExists(this.imageName)) {
            if(!rebuild) {
                return;
            }

            await this.dockerService.imageRm(this.imageName);
        }

        await this.dockerService.buildImage({
            tag: this.imageName,
            dockerfile: "./Dockerfile",
            context: Path.join(ROOT_DIR, "fixtures/dns")
        });
    }
}
