import {
    Controller,
    Description,
    Command,
    Param,
    Option
} from "@wocker/core";
import {promptInput} from "@wocker/utils";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Project secret commands")
export class SecretsController {
    public constructor(
        protected readonly projectService: ProjectService
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
}
