import {
    Controller,
    Completion,
    Command,
    Param,
    Option
} from "@wocker/core";

import {ProjectService, CertService} from "../services";


@Controller()
export class CertController {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly certService: CertService
    ) {}

    @Command("certs")
    public async list(): Promise<string> {
        return this.certService.list();
    }

    @Command("cert:generate [cert]")
    public async createCert(
        @Param("cert")
        certName?: string,
        @Option("dns", {
            type: "string",
            alias: "d",
            description: "DNS for cert"
        })
        dns?: string[]
    ): Promise<void> {
        await this.certService.generate(certName, dns);
    }

    @Command("cert:use [cert]")
    public async use(
        @Param("cert")
        certName?: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.certService.use(project, certName);
    }

    @Command("cert:remove")
    public async remove(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.certService.remove(project);
    }

    @Command("cert:delete <cert>")
    public async delete(
        @Param("cert")
        cert: string
    ): Promise<void> {
        await this.certService.delete(cert);
    }

    @Completion("cert", "cert:use [cert]")
    @Completion("cert", "cert:delete <cert>")
    public async existsNames(): Promise<string[]> {
        return Object.keys(await this.certService.getCertsMap());
    }

    @Completion("cert")
    public async existsOtherNames(): Promise<string[]> {
        return [];
    }
}
