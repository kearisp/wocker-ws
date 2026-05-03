import {
    Controller,
    Command,
    Description,
    Option,
    AppService
} from "@wocker/core";
import {promptSelect} from "@wocker/prompts";
import {KeystoreService} from "../services/KeystoreService";


@Controller()
@Description("Keystore commands")
export class KeystoreController {
    public constructor(
        protected readonly appService: AppService,
        protected readonly keystoreService: KeystoreService
    ) {}

    @Command("keystore:init")
    @Description("Initialize keystore")
    public async init(
        @Option("provider", "p")
        @Description("Keystore provider name")
        provider?: string
    ): Promise<void> {
        if(!provider) {
            provider = await promptSelect({
                required: true,
                message: "Keystore provider",
                type: "text",
                options: ["file", "keytar"],
                default: this.appService.config.keystore
            });
        }

        if(!this.keystoreService.hasProvider(provider)) {
            throw new Error(`Provider "${provider}" not found`);
        }

        this.appService.config.keystore = provider;
        this.appService.save();
    }
}
