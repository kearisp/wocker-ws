import {
    Controller,
    Description,
    Command,
    Param,
    Option,
    KeystoreService
} from "@wocker/core";
import {promptInput} from "@wocker/prompts";
import CliTable from "cli-table3";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Project secret commands")
export class SecretsController {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly keystoreService: KeystoreService
    ) {}

    @Command("secret:create [secret]")
    @Description("Adds project secret value to keystore")
    public async create(
        @Param("secret")
        secret?: string,
        @Option("name", "n")
        name?: string,
        @Option("global", "g")
        global?: boolean
    ): Promise<void> {
        const project = this.projectService.get(name);

        const value = await promptInput({
            message: "Secret value",
            type: "password"
        });

        await project.setSecret(secret, value);
    }

    @Command("secret:inspect [secret]")
    @Description("Inspect secret value")
    public async inspect(
        @Param("secret")
        secret?: string,
        @Option("name", "n")
        name?: string
    ): Promise<string | undefined> {
        const project = this.projectService.get(name);

        return project.getSecret(secret);
    }

    @Command("secret:rm [secret]")
    @Description("Delete secret value")
    public async rm(
        @Param("secret")
        secret?: string,
        @Option("name", "n")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await project.unsetSecret(secret);
    }

    @Command("secret:ls")
    public async list(
        @Option("name", "n")
        name?: string
    ) {
        const project = this.projectService.get(name);

        const table = new CliTable({
            head: ["Name"]
        });

        const names = await project.getSecrets();

        for(const name of names) {
            table.push([name]);
        }

        return table.toString();
    }
}
