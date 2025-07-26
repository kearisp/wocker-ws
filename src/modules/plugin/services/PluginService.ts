import {
    Cli,
    Injectable,
    AppConfigService,
    LogService
} from "@wocker/core";
import CliTable from "cli-table3";
import colors from "yoctocolors-cjs";
import {NpmService} from "../../npm";
import {Http, Plugin} from "../../../makes";
import {exec, spawn} from "../../../utils";


@Injectable()
export class PluginService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly npmService: NpmService,
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
            if(await this.checkPlugin(fullName)) {
                this.appConfigService.addPlugin(fullName);
                this.appConfigService.save();

                console.info(`Plugin ${fullName} activated`);

                return;
            }

            const packageInfo = await this.npmService.getPackageInfo(fullName);

            const env = packageInfo["dist-tags"].beta && beta ? "beta" : "latest";
            await this.npmService.install(fullName, env);

            if(await this.checkPlugin(fullName)) {
                this.appConfigService.addPlugin(fullName, env);
                this.appConfigService.save();

                console.info(`Plugin ${fullName}@${env} activated`);

                return;
            }
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

        this.appConfigService.removePlugin(fullName);
        this.appConfigService.save();

        console.info(`Plugin ${fullName} deactivated`);
    }

    public async import(name: string): Promise<Plugin> {
        const {default: type} = await import(name);

        return new Plugin(type);
    }

    public async update(name?: string): Promise<void> {
        if(this.appConfigService.plugins.length === 0) {
            return;
        }

        for(const plugin of this.appConfigService.plugins) {
            console.info(`Checking ${plugin.name}...`);

            try {
                const current = await this.getCurrentVersion(plugin.name);

                const res = await Http.get("https://registry.npmjs.org")
                    .send(plugin.name);

                if(res.status !== 200) {
                    continue;
                }

                const {
                    "dist-tags": {
                        latest
                    }
                } = res.data;

                this.logService.info(plugin.name, current, latest);

                if(!current || current < latest) {
                    console.log(`Updating ${plugin.name}...`);

                    await spawn("npm", ["i", "-g", plugin.name]);
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
