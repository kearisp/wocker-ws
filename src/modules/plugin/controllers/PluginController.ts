import {
    Controller,
    Command,
    Option,
    Param,
    Completion,
    Description,
    AppConfigService
} from "@wocker/core";
import {PluginService} from "../services/PluginService";


@Controller()
@Description("Plugin commands")
export class PluginController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pluginService: PluginService
    ) {}

    @Command("plugins")
    @Description("Plugins list")
    public async list(): Promise<string> {
        return this.pluginService.getPluginsTable();
    }

    @Command("plugin:install <name>")
    @Description("Install a plugin by specifying its name")
    public async add(
        @Param("name")
        @Description("Name to install a plugin")
        addName: string,
        @Option("beta", {
            type: "boolean",
            alias: "d",
            description: "Use the beta version of the plugin (if a beta version exists). Defaults to the latest stable version."
        })
        beta?: boolean
    ): Promise<void> {
        await this.pluginService.install(addName, beta);
    }

    @Command("plugin:remove <name>")
    @Description("Remove a plugin")
    public async remove(
        @Param("name")
        @Description("Name to remove a plugin")
        removeName: string
    ): Promise<void> {
        await this.pluginService.uninstall(removeName);
    }

    @Command("plugin:update [name]")
    public async update(
        @Param("name")
        @Description("Name to update a plugin")
        name?: string
    ): Promise<void> {
        await this.pluginService.update(name);
    }

    @Completion("name", "plugin:update [name]")
    @Completion("name", "plugin:remove <name>")
    public getInstalledPlugins(): string[] {
        return this.appConfigService.config.plugins.map(p => p.name);
    }
}
