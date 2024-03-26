import {Cli} from "@kearisp/cli";
import * as Path from "path";

import {DATA_DIR, MAP_PATH} from "./env";
import {setConfig} from "./utils";
import {FS, Logger} from "./makes";
import {
    AppConfigService
} from "./services";


export class App {
    protected cli: Cli;
    protected appConfigService: AppConfigService;

    public constructor() {}

    public install() {
        this.cli.command("completion script")
            .help(false)
            .action(() => this.cli.completionScript());

        this.cli.command("log [...items]")
            .action((options, items) => {
                Logger.log(...items as string[]);

                return "";
            });

        this.cli.command("debug <status>")
            .completion("status", () => ["on", "off"])
            .action(async (options, status: string) => this.setDebug(status));
    }

    public use(Constructor: any): void {
        //
    }

    public async setDebug(status: string) {
        Logger.info(`Set debug ${status}`);

        await setConfig({
            debug: status === "on"
        });

        return "";
    }

    public async run(): Promise<string> {
        const mapDir = Path.dirname(MAP_PATH);

        if(!FS.existsSync(mapDir)) {
            await FS.mkdir(mapDir);
        }

        if(!FS.existsSync(MAP_PATH)) {
            await FS.writeJSON(MAP_PATH, {
                projects: []
            });
        }

        if(!FS.existsSync(`${DATA_DIR}/projects`)) {
            await FS.mkdir(`${DATA_DIR}/projects`);
        }

        const {
            plugins = []
        } = await this.appConfigService.getAppConfig();

        for(const plugin of plugins) {
            try {
                const {default: Plugin} = await import(plugin);

                this.use(Plugin);
            }
            catch(err) {
                Logger.error(err.message);
            }
        }

        return this.cli.run(process.argv);
    }
}
