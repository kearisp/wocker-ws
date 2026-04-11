import {
    Command,
    Param,
    Completion,
    Controller,
    LogService,
    AppService
} from "@wocker/core";


@Controller()
export class DebugController {
    public constructor(
        protected readonly appService: AppService,
        protected readonly logService: LogService
    ) {}

    @Command("debug")
    public async debug(): Promise<string> {
        return this.appService.debug ? "on" : "off";
    }

    @Command("debug:<status>")
    @Command("debug <status>")
    public async setDebug(
        @Param("status")
        status: string
    ): Promise<void> {
        this.appService.debug = status === "on";
    }

    @Command("log:<level> [...args]")
    public async testLog(
        @Param("level")
        level: string,
        @Param("args")
        args: string[]
    ): Promise<void> {
        (this.logService as any)._log(level, ...args);
    }

    @Completion("status")
    public async debugCompletion(): Promise<string[]> {
        return ["on", "off"];
    }

    @Completion("level")
    public getLevels(): string[] {
        return ["debug", "info", "warn", "error"];
    }
}
