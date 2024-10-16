import {
    Cli,
    Injectable,
    PLUGIN_NAME_METADATA
} from "@wocker/core";

import {AppConfigService} from "./AppConfigService";
import {LogService} from "./LogService";
import {Http} from "../makes";
import {exec, spawn} from "../utils";


@Injectable()
export class PluginService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly logService: LogService,
        protected readonly cli: Cli
    ) {}

    public async checkPlugin(pluginName: string): Promise<boolean> {
        try {
            const {default: Plugin} = await import(pluginName);

            const name = Reflect.getMetadata(PLUGIN_NAME_METADATA, Plugin);

            if(!name) {
                console.error("No name");
            }

            return !!name;
        }
        catch(err) {
            this.logService.error(err.message);
        }

        return false;
    }

    public async import() {
        //
    }

    public async update() {
        const config = await this.appConfigService.getConfig();

        if(!config.plugins) {
            return;
        }

        for(const name of new Set(config.plugins).values()) {
            console.info(`Checking ${name}...`);

            try {
                const current = await this.getCurrentVersion(name);

                const res = await Http.get("https://registry.npmjs.org")
                    .send(name);

                if(res.status !== 200) {
                    continue;
                }

                const {
                    "dist-tags": {
                        latest
                    }
                } = res.data;

                this.logService.info(name, current, latest);

                if(!current || current < latest) {
                    console.log(`Updating ${name}...`);

                    await spawn("npm", ["i", "-g", name]);
                }
            }
            catch(err) {
                this.logService.error(err.message);
            }
        }

        console.info("Done");
    }

    protected async getCurrentVersion(name: string): Promise<string|null> {
        try {
            const {
                dependencies: {
                    [name]: {
                        version
                    }
                }
            } = JSON.parse(await exec(`npm ls --json -g ${name}`));

            return version;
        }
        catch(err) {
            this.logService.error(`Failed to get current version of ${name}`);
        }

        return null;
    }
}
