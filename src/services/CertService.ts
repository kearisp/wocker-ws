import {Injectable, Project} from "@wocker/core";

import {DockerService} from "./DockerService";
import {ProjectService} from "./ProjectService";


@Injectable()
export class CertService {
    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async generate(project: Project, name: string): Promise<void> {
        const container = await this.dockerService.getContainer("proxy.workspace");

        if(!container) {
            throw new Error("Proxy not started");
        }

        if(!project.domains) {
            throw new Error("Project haven't domains");
        }

        await this.dockerService.exec(container, {
            tty: true,
            cmd: ["wocker-create-root-cert"]
        });

        await this.dockerService.exec(container, {
            tty: true,
            cmd: ["wocker-create-domains", name, ...project.domains]
        });

        await this.dockerService.exec(container, {
            tty: true,
            cmd: ["wocker-create-cert-v2", name]
        });

        await this.use(project, name);
    }

    public async use(project: Project, name: string): Promise<void> {
        project.setEnv("CERT_NAME", name);

        await project.save();
    }
}
