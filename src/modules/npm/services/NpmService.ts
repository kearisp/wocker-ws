import {Injectable} from "@wocker/core";
import {Http} from "../../../makes";
import {exec} from "../../../utils";
import {PackageInfo} from "../../../types";


@Injectable()
export class NpmService {
    public async getPackageInfo(name: string): Promise<PackageInfo> {
        const res = await Http.get("https://registry.npmjs.org")
            .send(name);

        if(res.status === 404) {
            throw new Error("Package not found");
        }

        if(res.status !== 200) {
            throw new Error("Network error");
        }

        return res.data;
    }

    public async install(name: string, version?: string): Promise<void> {
        console.info(`npm install -g ${version ? `${name}@${version}` : name}`);

        await exec(`npm install -g ${version ? `${name}@${version}` : name}`);
    }
}
