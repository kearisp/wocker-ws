import {
    Factory,
    CommandNotFoundError,
    UsageException
} from "@wocker/core";
import colors from "yoctocolors-cjs";
import {AppModule} from "./AppModule";
import {AppConfigService} from "./services/AppConfigService";
import {LogService} from "./services/LogService";


export const app = {
    async run(args: string[]): Promise<void> {
        const app = await Factory.create(AppModule);
        const configService = app.get(AppConfigService);
        const logger = app.get(LogService);

        try {
            const res = await app.run(args);

            if(res) {
                process.stdout.write(res);
                process.stdout.write("\n");
            }
        }
        catch(err) {
            if(typeof err.name === "string" && ["ExitPromptError", "CancelPromptError", "AbortPromptError"].includes(err.name)) {
                return;
            }

            console.error(colors.red(err.message));

            if(err instanceof UsageException || err.name === "UsageException") {
                return;
            }

            if(err instanceof CommandNotFoundError) {
                return;
            }

            if(configService.config.debug) {
                logger.error(err.stack || err.toString());
            }
        }
    }
};
