import {
    Controller,
    Completion,
    Command,
    Param,
    Option
} from "@wocker/core";

import {
    ProjectService,
    CertService,
    LogService
} from "../services";


@Controller()
export class CertController {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly certService: CertService,
        protected readonly logService: LogService
    ) {}

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

    @Command("cert:remove <cert>")
    public async remove(
        @Param("cert")
        cert: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        await this.certService.remove(cert);
    }

    @Command("cert:delete <cert>")
    public async delete(
        @Param("cert")
        cert: string
    ): Promise<void> {
        await this.certService.delete(cert);
    }

    @Completion("cert", "cert:remove <cert>")
    @Completion("cert", "cert:delete <cert>")
    public async existsNames(
        @Param("cert")
        name?: string
    ): Promise<string[]> {
        return Object.keys(await this.certService.getCertsMap());
    }

    @Completion("cert")
    public async existsOtherNames(): Promise<string[]> {
        return [];
    }
}
