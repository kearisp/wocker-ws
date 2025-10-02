import {
    AppConfigService,
    Injectable
} from "@wocker/core";
import {promptSelect} from "@wocker/utils";
import {NpmProvider} from "../providers/NpmProvider";
import {PnpmProvider} from "../providers/PnpmProvider";
import {YarnProvider} from "../providers/YarnProvider";
import {PackageManagerProvider} from "../types/PackageManagerProvider";


@Injectable("PACKAGE_MANAGER_SERVICE")
export class PackageManager {
    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {}

    public async getManager(): Promise<PackageManagerProvider> {
        if(!this.appConfigService.config.pm) {
            this.appConfigService.config.pm = await promptSelect({
                label: "Package manager:",
                options: [
                    {
                        label: "NPM",
                        value: "npm"
                    },
                    {
                        label: "PNPM",
                        value: "pnpm"
                    },
                    {
                        label: "YARN",
                        value: "yarn"
                    }
                ],
                required: true
            });

            this.appConfigService.save();
        }

        switch(this.appConfigService.config.pm) {
            case "npm":
                return new NpmProvider();

            case "pnpm":
                return new PnpmProvider();

            case "yarn":
                return new YarnProvider();
        }
    }

    public async getPackages(global?: boolean) {
        const pm = await this.getManager();

        return pm.getPackages(global);
    }

    public async install(name: string, version?: string): Promise<void> {
        const pm = await this.getManager();

        await pm.install(name, version);
    }

    public async uninstall(name: string): Promise<void> {
        const pm = await this.getManager();

        await pm.uninstall(name);
    }
}
