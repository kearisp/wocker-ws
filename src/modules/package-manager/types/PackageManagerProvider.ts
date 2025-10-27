import {Package} from "./Package";


export abstract class PackageManagerProvider {
    public abstract getPackages(global?: boolean): Promise<Package[]>;
    public abstract install(name: string, version?: string): Promise<void>;
    public abstract uninstall(name: string): Promise<void>;
}
