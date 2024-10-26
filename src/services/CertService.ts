import {Injectable, Project} from "@wocker/core";
import * as Path from "path";

import {AppConfigService} from "./AppConfigService";
import {DockerService} from "./DockerService";
import {ProjectService} from "./ProjectService";


@Injectable()
export class CertService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {}

    public async generate(name: string, dns: string[]): Promise<void> {
        const container = await this.dockerService.getContainer("proxy.workspace");

        if(!container) {
            throw new Error("Proxy not started");
        }

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-root-cert"]
        });

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-domains", name, ...dns]
        });

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-cert-v2", name]
        });
    }

    public async use(project: Project, name: string): Promise<void> {
        const files = await this.appConfigService.fs.readdir("certs");

        const certs = files.reduce((res, file) => {
            const ext = Path.extname(file);
            const name = Path.basename(file, ext);

            if(!res[name]) {
                res[name] = [];
            }

            res[name].push(ext);

            return res;
        }, {});

        if(!(name in certs)) {
            throw new Error(`Cert ${name} not found`);
        }

        const cert: string[] = certs[name];

        if(!cert.includes(".crt")) {
            throw new Error(`${name}.crt file missing`);
        }

        if(!cert.includes(".key")) {
            throw new Error(`${name}.key file missing`);
        }

        project.setEnv("CERT_NAME", name);

        await project.save();
    }

    public async remove(name: string) {

    }

    public async delete(name: string): Promise<void> {

    }
}
