import {Controller, Command, Completion} from "@wocker/core";
import chalk from "chalk";
import CliTable from "cli-table3";

import {AppConfigService, PluginService, LogService} from "../services";
import {exec} from "../utils";
import {Http} from "../makes/Http";


@Controller()
export class PluginController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginService: PluginService,
        protected readonly logService: LogService
    ) {}

    @Command("plugins")
    public async list() {
        const config = await this.appConfigService.getConfig();
        const table = new CliTable({
            head: ["Name"],
            colWidths: [30]
        });

        for(const name of config.plugins) {
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

        this.logService.info(`Installing plugin... ${fullName}`);

        const config = await this.appConfigService.getConfig();

        try {
            if(await this.pluginService.checkPlugin(fullName)) {
                config.addPlugin(fullName);

                await config.save();

                console.info(`Plugin ${fullName} activated`);

                return;
            }

            const res = await Http.get("https://registry.npmjs.org")
                .send(fullName);

            if(res.status !== 200) {
                console.error(chalk.red(`Plugin ${fullName} not found`));
                return;
            }

            console.info(`Installing ${fullName}`);

            await exec(`npm install -g ${fullName}`);

            if(await this.pluginService.checkPlugin(fullName)) {
                config.addPlugin(fullName);

                await config.save();

                console.info(`Plugin ${fullName} activated`);

                return;
            }
        }
        catch(err) {
            this.logService.error(err.message);
        }
    }

    @Command("plugin:remove <name>")
    public async remove(removeName: string) {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(removeName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        const config = await this.appConfigService.getConfig();

        config.removePlugin(fullName);

        await config.save();

        console.info(`Plugin ${fullName} deactivated`);
    }

    @Command("plugin:update [name]")
    public async update() {
        await this.pluginService.update();
    }

    @Completion("name", "plugin:update [name]")
    @Completion("name", "plugin:remove <name>")
    public async getInstalledPlugins() {
        const config = await this.appConfigService.getConfig();

        return config.plugins || [];
    }
}
