import {Controller, Command} from "@wocker/core";
import axios from "axios";
import chalk from "chalk";
import CliTable from "cli-table3";

import {AppConfigService, PluginService, LogService} from "../services";
import {exec} from "../utils";
import * as console from "console";


@Controller()
export class PluginController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginService: PluginService,
        protected readonly logService: LogService
    ) {}

    @Command("plugins")
    public async list() {
        const {
            plugins
        } = await this.appConfigService.getAppConfig();
        const table = new CliTable({
            head: ["Name"],
            colWidths: [30]
        });

        for(const name of plugins) {
            table.push([name]);
        }

        return table.toString() + "\n";
    }

    @Command("plugin:add <name>")
    public async add(addName: string) {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(addName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        try {
            const {default: Plugin} = await import(fullName);

            // this.pluginService.use(Plugin);

            await this.appConfigService.activatePlugin(fullName);

            console.info(`Plugin ${fullName} activated`);
            return;
        }
        catch(err) {
            this.logService.error(err.message);
        }

        try {
            const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(fullName)}`, {
                validateStatus: () => true
            });

            if(res.status !== 200) {
                console.error(chalk.red(`Plugin ${fullName} not found`));
                return;
            }

            console.info(`Installing ${fullName}`);

            await exec(`npm install -g ${fullName}`);

            await this.appConfigService.activatePlugin(fullName);
        }
        catch(err) {
            this.logService.error(err.message);
        }
    }

    @Command("plugin:remove <name>")
    public async remove(
        removeName: string
    ) {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(removeName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        await this.appConfigService.deactivatePlugin(fullName);

        console.info(`Plugin ${fullName} deactivated`);
    }
}
