import * as Path from "path";
import {Cli} from "@kearisp/cli";

import {DATA_DIR, MAP_PATH} from "src/env";
import {setConfig} from "src/utils";
import {
    Controller,
    Plugin,
    FS,
    Logger
} from "src/makes";
import {AppConfigService} from "src/services";


export class App {
    protected cli: Cli;

    public constructor(
        protected config: AppConfigService
    ) {
        this.cli = new Cli(Logger);

        this.install();
    }

    public install() {
        this.cli.command("completion script")
            .help(false)
            .action(() => this.cli.completionScript());

        this.cli.command("debug <status>")
            .completion("status", () => ["on", "off"])
            .action(async (options, status: string) => this.setDebug(status));
    }

    public useController(controller: Controller) {
        controller.install(this.cli);
    }

    public usePlugin(plugin: Plugin) {
        plugin.install(this.cli);
    }

    public async setDebug(status: string) {
        Logger.info(`Set debug ${status}`);

        await setConfig({
            debug: status === "on"
        });
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

        return this.cli.run(process.argv);
    }
}
