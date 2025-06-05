import {
    Controller,
    Command,
    Description,
    Param,
    Option
} from "@wocker/core";
import {promptInput, promptSelect} from "@wocker/utils";
import {AppConfigService} from "../../../services/AppConfigService";
import {KeystoreService} from "../services/KeystoreService";


@Controller()
@Description("Keystore commands")
export class KeystoreController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly keystoreService: KeystoreService
    ) {}

    @Command("keystore:init")
    public async init(
        @Option("provider", {
            type: "string",
            description: "Keystore provider name"
        })
        provider?: string
    ): Promise<void> {
        if(!provider) {
            provider = await promptSelect({
                message: "Keystore provider",
                type: "text",
                options: ["file", "keytar"]
            });
        }

        if(!this.keystoreService.hasProvider(provider)) {
            return;
        }

        this.appConfigService.config.keystore = provider;
        this.appConfigService.save();
    }

    @Command("secret:create [name]")
    @Description("Adds secret value to keystore")
    public async add(
        @Param("name")
        name?: string,
        @Option("provider", {
            alias: "p",
            type: "string",
            description: "Provider name"
        })
        provider?: string
    ): Promise<void> {
        const value = await promptInput({
            message: "Secret value",
            type: "password"
        });

        await this.keystoreService.provider(provider).set(name, value);
    }

    @Command("secret:inspect [name]")
    public async inspect(
        @Param("name")
        name?: string,
        @Option("provider", {
            type: "string",
            alias: "p"
        })
        provider?: string
    ): Promise<string | undefined> {
        return this.keystoreService.provider(provider).get(name);
    }

    @Command("secret:rm [name]")
    @Description("Removes secret value from keystore")
    public async delete(
        @Param("name")
        name?: string,
        @Option("provider", {
            type: "string",
            alias: "p",
            description: "Provider name"
        })
        provider?: string
    ): Promise<void> {
        await this.keystoreService.provider(provider).delete(name);
    }
}
