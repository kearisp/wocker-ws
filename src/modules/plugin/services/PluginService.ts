import {
    Cli,
    Injectable,
    AppConfigService,
    LogService
} from "@wocker/core";
import CliTable from "cli-table3";
import colors from "yoctocolors-cjs";
import {PackageManager, RegistryService} from "../../package-manager";
import {Plugin} from "../../../makes";


@Injectable()
export class PluginService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly pm: PackageManager,
        protected readonly registryService: RegistryService,
        protected readonly logService: LogService,
        protected readonly cli: Cli
    ) {}

    public getPluginsTable(): string {
        const table = new CliTable({
            head: ["Name", "Env"],
            colWidths: [30]
        });

        if(this.appConfigService.plugins.length === 0) {
            return colors.gray("No plugins installed");
        }

        for(const plugin of this.appConfigService.plugins) {
            table.push([plugin.name, plugin.env]);
        }

        return table.toString();
    }

    public async checkPlugin(pluginName: string): Promise<boolean> {
        try {
            await this.import(pluginName);

            return true;
        }
        catch(err) {
            this.logService.error(err.message, {
                pluginName
            });
        }

        return false;
    }

    public async install(pluginName: string, beta?: boolean): Promise<void> {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(pluginName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        try {
            if(!await this.checkPlugin(fullName)) {
                const packageInfo = await this.registryService.getPackageInfo(fullName),
                      env = packageInfo["dist-tags"].beta && beta ? "beta" : "latest";

                await this.pm.install(fullName, env);
            }

            this.appConfigService.addPlugin(fullName);
            this.appConfigService.save();

            console.info(`Plugin ${fullName} activated`);
        }
        catch(err) {
            this.logService.error(err.message);
        }
    }

    public async uninstall(pluginName: string): Promise<void> {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(pluginName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        if(await this.checkPlugin(fullName)) {
            await this.pm.uninstall(fullName);
        }

        this.appConfigService.removePlugin(fullName);
        this.appConfigService.save();

        console.info(`Plugin ${fullName} deactivated`);
    }

    public async import(name: string): Promise<Plugin> {
        const {default: type} = await import(name);

        return new Plugin(type);
    }

    public async update(): Promise<void> {
        if(this.appConfigService.plugins.length === 0) {
            console.info("No plugins installed");
            return;
        }

        for(const plugin of this.appConfigService.plugins) {
            console.info(`Checking ${plugin.name}...`);

            try {
                const current = await this.getCurrentVersion(plugin.name),
                      info = await this.registryService.getPackageInfo(plugin.name);

                const {
                    "dist-tags": {
                        latest,
                        beta
                    }
                } = info;

                const newVersion = plugin.env === "latest"
                    ? latest
                    : beta || latest;

                this.logService.info(plugin.name, current, newVersion);

                if(!current || current !== latest) {
                    console.log(`Updating ${plugin.name}...`);

                    await this.pm.install(plugin.name, newVersion);
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
            const packages = await this.pm.getPackages(),
                  package1  = packages.find((p) => p.name === name);

            if(package1) {
                return package1.version;
            }
        }
        catch(err) {
            this.logService.error(`Failed to get current version of ${name}`);
        }

        return null;
    }
}
