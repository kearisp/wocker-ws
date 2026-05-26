import {Injectable} from "@wocker/core";
import {Http} from "@wocker/utils";
import {PackageInfo} from "../types/PackageInfo";


@Injectable()
export class RegistryService {
    public async getPackageInfo(name: string): Promise<PackageInfo> {
        const res = await Http.base("https://registry.npmjs.org")
            .get(name)
            .send<PackageInfo>();

        if(res.status === 404) {
            throw new Error("Package not found");
        }

        if(res.status !== 200) {
            throw new Error("Network error");
        }

        return res.json();
    }
}
