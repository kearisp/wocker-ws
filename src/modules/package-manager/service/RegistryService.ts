import {Injectable} from "@wocker/core";
import {Http} from "../../../makes";
import {PackageInfo} from "../types/PackageInfo";


@Injectable()
export class RegistryService {
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
}
