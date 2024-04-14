import {Command, Completion, Controller} from "@wocker/core";

import {AppConfigService, LogService} from "../services";


@Controller()
export class DebugController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly logService: LogService
    ) {}

    @Command("debug <status>")
    public async debug(status: string) {
        const config = await this.appConfigService.getConfig();

        config.debug = status === "on";

        await config.save();
    }

    @Completion("status")
    public async debugCompletion() {
        return ["on", "off"];
    }
}