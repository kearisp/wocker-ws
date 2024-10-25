import {
    Controller,
    Command,
    Param,
    Option
} from "@wocker/core";

import {
    ProjectService,
    CertService
} from "../services";


@Controller()
export class CertController {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly certService: CertService
    ) {}

    @Command("cert:generate [name]")
    public async create(
        @Param("name")
        certName?: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);
        // console.log(certName, name);

        await this.certService.generate(project, certName);
    }

    @Command("cert:use [name]")
    public async use(
        @Param("name")
        certName?: string,
        @Option("name", {
            type: "string",
            alias: "n",
            description: "The name of the project"
        })
        name?: string
    ): Promise<void> {

    }

    @Command("cert:remove <name>")
    public async remove(
        @Param("name")
        name: string
    ): Promise<void> {

    }

    public async list(): Promise<void> {

    }
}
