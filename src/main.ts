import {
    Factory,
    AppConfigService,
    CommandNotFoundError,
    UsageException,
    LogService
} from "@wocker/core";
import colors from "yoctocolors-cjs";
import {AppModule} from "./AppModule";


// noinspection JSUnusedGlobalSymbols
export const app = {
    async run(args: string[]): Promise<void> {
        const context = await Factory.create(AppModule),
              appConfigService = context.get(AppConfigService),
              logService = context.get(LogService);

        try {
            const res = await context.run(args);

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

            if(appConfigService.debug) {
                logService.error(err.stack || err.toString());
            }
        }
    }
};
