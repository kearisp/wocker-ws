import {
    Controller,
    Command,
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

    @Command("plugin:install <...names>")
    @Description("Install a plugin by specifying its name")
    public async add(
        @Param("names")
        @Description("Name to install a plugin")
        names: string[]
    ): Promise<void> {
        for(const name of names) {
            await this.pluginService.install(name);
        }
    }

    @Command("plugin:remove <...names>")
    @Description("Remove a plugin")
    public async remove(
        @Param("names")
        @Description("Name to remove a plugin")
        names: string[]
    ): Promise<void> {
        for(const name of names) {
            await this.pluginService.uninstall(name);
        }
    }

    @Command("plugin:update")
    public async update(): Promise<void> {
        await this.pluginService.update();
    }

    @Completion("names", "plugin:remove <...names>")
    public getInstalledPlugins(): string[] {
        return this.appConfigService.plugins.map(pluginRef => pluginRef.name);
    }
}
