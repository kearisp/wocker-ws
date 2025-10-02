import {PackageManagerProvider} from "../types/PackageManagerProvider";
import {Package} from "../types/Package";
import {exec} from "../../../utils";


export class YarnProvider extends PackageManagerProvider {
    public async getPackages(): Promise<Package[]> {
        const res = await exec("yarn global list --json --depth=0"),
              text = res.replace(/}\s*\{/g, '},{'),
              items: any[] = JSON.parse(`[${text}]`),
              packages: Package[] = [];

        for(const item of items) {
            if(item.type === "info") {
                const [, name, version] = /^"(.*)@(.*)".*$/.exec(item.data);

                packages.push({
                    name,
                    version
                });
            }
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
