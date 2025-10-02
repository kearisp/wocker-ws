import {Injectable} from "@wocker/core";
import {PackageManagerProvider} from "../types/PackageManagerProvider";
import {Package} from "../types/Package";
import {exec} from "../../../utils";


@Injectable()
export class NpmProvider extends PackageManagerProvider {
    public async getPackages(): Promise<Package[]> {
        const res = await exec("npm ls -g --json");

        const packages: Package[] = [],
              {dependencies} = JSON.parse(res);

        for(const name in dependencies) {
            packages.push({
                name: name,
                version: dependencies[name].version
            });
        }

        return packages;
    }

    public async install(name: string, version?: string): Promise<void> {
        const command = `npm install -g ${version ? `${name}@${version}` : name}`;

        console.info(`> ${command}`);

        await exec(command);
        // await spawn("npm", ["i", "-g", plugin.name]);
    }

    public async uninstall(name: string): Promise<void> {
        const command = `npm uninstall -g ${name}`;

        console.info(`> ${command}`);

        await exec(command);
    }
}
