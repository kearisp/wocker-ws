import {
    Cli,
    Injectable,
    AppConfigService,
    LogService
} from "@wocker/core";
import CliTable from "cli-table3";
import colors from "yoctocolors-cjs";
import {PackageManager, RegistryService} from "../../package-manager";
import {Plugin, Version, VersionRule} from "../../../makes";


@Injectable()
export class PluginService {
    protected rule = "1.x.x";

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

    public async install(pluginName: string, version: string = "latest"): Promise<void> {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(pluginName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        const currentVersion = await this.getCurrentVersion(fullName),
              wRule = VersionRule.parse(this.rule),
              rule = VersionRule.parse(version === "latest" ? "x" : version || this.rule);

        const packageInfo = await this.registryService.getPackageInfo(fullName);

        const versions = Object.keys(packageInfo.versions)
            .filter((version) => {
                return wRule.match(version, true) && rule.match(version, true);
            })
            .sort((a, b) => {
                return Version.parse(b).compare(a);
            });

        const bestSatisfyingVersion =
            versions.find((version) => rule.match(version)) ??
            versions.find((version) => rule.match(version, true));

        if(!bestSatisfyingVersion) {
            throw new Error(`No matching version found for ${fullName}@${version}.`);
        }

        if((!currentVersion || currentVersion !== bestSatisfyingVersion) || !await this.checkPlugin(fullName)) {
            await this.pm.install(fullName, bestSatisfyingVersion);
        }

        this.appConfigService.addPlugin(fullName, version);
        this.appConfigService.save();

        console.info(`Plugin ${fullName} activated`);
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
                await this.install(plugin.name, plugin.env);
            }
            catch(err) {
                console.info(err.message);

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
            this.logService.error(`Failed to get current version of "${name}"`);
        }

        return null;
    }
}
