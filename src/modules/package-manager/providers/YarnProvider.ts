import {PackageManagerProvider} from "../types/PackageManagerProvider";
import {Package} from "../types/Package";
import {exec} from "../../../utils";


export class YarnProvider extends PackageManagerProvider {
    public async getPackages(): Promise<Package[]> {
        const res = await exec("yarn --cwd `yarn global dir` list --json --depth=0"),
              three = JSON.parse(res),
              packages: Package[] = [];

        for(const item of three.data.trees) {
            const [, name, version] = /^(.*)@(.*)$/.exec(item.name);

            packages.push({
                name,
                version
            });
        }

        return packages;
    }

    public async install(name: string, version?: string): Promise<void> {
        const command = `yarn global add ${version ? `${name}@${version}` : name}`;

        console.info(`> ${command}`);

        await exec(command);
    }

    public async uninstall(name: string): Promise<void> {
        const command = `yarn global remove ${name}`;

        console.info(`> ${command}`);

        await exec(command);
    }
}
