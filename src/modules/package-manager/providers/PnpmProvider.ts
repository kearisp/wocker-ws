import {PackageManagerProvider} from "../types/PackageManagerProvider";
import {Package} from "../types/Package";
import {exec} from "../../../utils";


export class PnpmProvider extends PackageManagerProvider {
    public async getPackages(): Promise<Package[]> {
        const res = await exec("pnpm ls -g --json"),
              data = JSON.parse(res),
              dependencies = Array.isArray(data) ? data[0]?.dependencies : data.dependencies,
              packages: Package[] = [];

        if(dependencies) {
            for(const name in dependencies) {
                packages.push({
                    name,
                    version: dependencies[name].version
                });
            }
        }

        return packages;
    }

    public async install(name: string, version?: string): Promise<void> {
        const command = `pnpm add -g ${version ? `${name}@${version}` : name}`;

        console.info(`> ${command}`);
        await exec(command);
    }

    public async uninstall(name: string): Promise<void> {
        const command = `pnpm remove -g ${name}`;

        console.info(`> ${command}`);
        await exec(command);
    }
}
