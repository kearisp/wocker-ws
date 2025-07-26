import {
    Controller,
    Command,
    Description,
    Option,
    AppConfigService
} from "@wocker/core";
import {promptSelect} from "@wocker/utils";
import {KeystoreService} from "../services/KeystoreService";


@Controller()
@Description("Keystore commands")
export class KeystoreController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
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
}
