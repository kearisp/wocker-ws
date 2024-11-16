import {Controller, Command, Option, Param, Completion, Description} from "@wocker/core";
import chalk from "chalk";
import CliTable from "cli-table3";

import {AppConfigService, PluginService, LogService, NpmService} from "../services";


@Controller()
export class PluginController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginService: PluginService,
        protected readonly npmService: NpmService,
        protected readonly logService: LogService
    ) {}

    @Command("plugins")
    @Description("Plugins list")
    public async list(): Promise<string> {
        const config = this.appConfigService.getConfig();
        const table = new CliTable({
            head: ["Name"],
            colWidths: [30]
        });

        if(!config.plugins) {
            return chalk.gray("No plugins installed");
        }

        for(const name of config.plugins) {
            table.push([name]);
        }

        return table.toString() + "\n";
    }

    @Command("plugin:add <name>")
    @Command("plugin:install <name>")
    @Description("Install a plugin")
    public async add(
        @Param("name")
        addName: string,
        @Option("dev", {
            type: "boolean",
            alias: "d",
            description: "Use dev version of plugin"
        })
        dev?: boolean
    ): Promise<void> {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(addName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        const config = this.appConfigService.getConfig();

        try {
            if(await this.pluginService.checkPlugin(fullName)) {
                config.addPlugin(fullName);

                await config.save();

                console.info(`Plugin ${fullName} activated`);

                return;
            }

            const packageInfo = await this.npmService.getPackageInfo(fullName);

            await this.npmService.install(fullName, packageInfo["dist-tags"].dev && dev ? "dev" : "latest");

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
    public async remove(
        @Param("name")
        removeName: string
    ): Promise<void> {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(removeName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        const config = this.appConfigService.getConfig();

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
    public getInstalledPlugins(): string[] {
        const config = this.appConfigService.getConfig();

        return config.plugins || [];
    }
}
