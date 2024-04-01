import {Cli} from "@kearisp/cli";
import * as Path from "path";

import {DATA_DIR, MAP_PATH} from "./env";
import {FS} from "./makes";
import {AppConfigService} from "./services";


export class App {
    protected cli: Cli;
    protected appConfigService: AppConfigService;

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
