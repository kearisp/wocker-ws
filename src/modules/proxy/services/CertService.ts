import {Injectable, Project} from "@wocker/core";
import * as Path from "path";
import CliTable from "cli-table3";
import {DockerService} from "../../docker";
import {AppConfigService} from "../../../services/AppConfigService";
import {ProxyService} from "./ProxyService";


type CertMap = {
    [name: string]: string[];
};

@Injectable()
export class CertService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly proxyService: ProxyService,
        protected readonly dockerService: DockerService
    ) {}

    public async list(): Promise<string> {
        const table = new CliTable({
            head: ["Name"]
        });

        const certMap = this.getCertsMap();

        for(const name in certMap) {
            table.push([name]);
        }

        return table.toString();
    }

    public async generate(certName: string, dns: string[]): Promise<void> {
        if(!certName) {
            throw new Error("Cert name missing");
        }

        await this.proxyService.start();

        const container = await this.dockerService.getContainer("proxy.workspace");

        if(!container) {
            throw new Error("Proxy not started");
        }

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-ca"]
        });

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-domains", certName, ...(dns.length > 0 ? dns : [certName])]
        });

        await this.dockerService.exec(container, {
            tty: true,
            user: "1000",
            cmd: ["wocker-create-cert", certName]
        });
    }

    public getCertsMap(): CertMap {
        const files = this.appConfigService.fs.readdir("certs/projects");

        return files.reduce((res, file) => {
            const ext = Path.extname(file);
            const name = Path.basename(file, ext);

            if(!res[name]) {
                res[name] = [];
            }

            res[name].push(ext);

            return res;
        }, {});
    }

    public async use(project: Project, name: string): Promise<void> {
        const certs = this.getCertsMap();

        if(!name) {
            name = project.domains.find((domain) => domain in certs);
        }

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
        project.save();
    }

    public async remove(project: Project): Promise<void> {
        if(!project.hasEnv("CERT_NAME")) {
            return;
        }

        project.unsetEnv("CERT_NAME");
        project.save();
    }

    public async delete(name: string): Promise<void> {
        const certs = this.getCertsMap();

        if(!(name in certs)) {
            console.warn(`Cert ${name} not found`);
            return;
        }

        for(const ext of certs[name]) {
            this.appConfigService.fs.rm(`certs/projects/${name}${ext}`);
        }

        console.info(`Cert ${name} deleted`);
    }
}
