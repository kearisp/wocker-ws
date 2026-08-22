import {
    Command,
    Description,
    Option,
    Param,
    Completion,
    Controller,
    LogService,
    AppService,
    AppFileSystemService
} from "@wocker/core";
import colors from "yoctocolors-cjs";
import {Mutex} from "async-mutex";


@Controller()
export class DebugController {
    public constructor(
        protected readonly appService: AppService,
        protected readonly logService: LogService,
        protected readonly fs: AppFileSystemService
    ) {}

    @Command("debug")
    public async debug(): Promise<string> {
        return this.appService.debug ? "on" : "off";
    }

    @Command("debug:logs")
    @Description("Wocker logs")
    public async log(
        @Option("follow", "f")
        @Description("Follow")
        follow?: boolean,
        @Option("clear", "c")
        @Description("Clear log file")
        clear?: boolean,
        @Option("tail", "t")
        @Description("Number of lines to show from the end of the log")
        tail: number = 10
    ): Promise<void> {
        if(tail === 0) {
            throw new Error("Option \"tail\" must be greater than 0");
        }

        if(clear) {
            this.logService.clear();
        }

        const unescapeLog = (str: string): string => {
            return str.replace(/\\(\\|n)/g, (_, char) => char === "n" ? "\n" : "\\");
        };

        const prepareLog = (str: string) => {
            return str.replace(/^\[.*]\s([^:]+):\s.*$/gm, (substring, type) => {
                const unescaped = unescapeLog(substring);

                switch(type) {
                    case "debug":
                        return colors.gray(unescaped);

                    case "log":
                        return colors.white(unescaped);

                    case "info":
                        return colors.green(unescaped);

                    case "warn":
                    case "warning":
                        return colors.yellow(unescaped);

                    case "error":
                        return colors.red(unescaped);

                    default:
                        return unescaped;
                }
            });
        };

        const file = this.fs.open("ws.log", "r");

        const stream = file.createReadlineStream({
            start: -Math.abs(tail)
        });

        stream.on("data", (line: string): void => {
            process.stdout.write(prepareLog(line));
            process.stdout.write("\n");
        });

        if(follow) {
            const stats = file.stat();

            const watcher = this.fs.watch("ws.log");
            const mutex = new Mutex();

            let position = stats.size;

            watcher.on("change", async () => {
                await mutex.acquire();

                try {
                    const stats = file.stat();

                    if(stats.size < position) {
                        console.info("file truncated");

                        position = 0;
                    }

                    const buffer = file.readBytes(position);

                    position += buffer.length;

                    process.stdout.write(prepareLog(buffer.toString("utf-8")));
                }
                finally {
                    mutex.release();
                }
            });
        }
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
