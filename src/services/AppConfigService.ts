import {
    Injectable,
    Config,
    ConfigProperties,
    AppConfigService as CoreAppConfigService
} from "@wocker/core";
import * as Path from "path";

import {MAP_PATH, DATA_DIR, PLUGINS_DIR} from "../env";
import {FS} from "../makes";


type TypeMap = {
    [type: string]: string;
};

@Injectable("APP_CONFIG")
export class AppConfigService extends CoreAppConfigService {
    protected pwd: string;
    protected mapTypes: TypeMap = {
        image: "Image",
        dockerfile: "Dockerfile"
    };

    public constructor() {
        super();

        this.pwd = (process.cwd() || process.env.PWD);
    }

    public dataPath(...args: string[]): string {
        return Path.join(DATA_DIR, ...args);
    }

    public pluginsPath(...args: string[]): string {
        return Path.join(PLUGINS_DIR, ...args);
    }

    public getPWD(): string {
        return this.pwd;
    }

    public setPWD(pwd: string): void {
        this.pwd = pwd;
    }

    public getProjectTypes() {
        return this.mapTypes;
    }

    public registerProjectType(name: string, title?: string) {
        this.mapTypes[name] = title || name;
    }

    protected async loadConfig(): Promise<Config> {
        const data = FS.existsSync(MAP_PATH)
            ? await FS.readJSON(MAP_PATH)
            : {};

        return new class extends Config {
            public constructor(data: ConfigProperties) {
                super(data);
            }

            public addPlugin(plugin: string): void {
                if(!this.plugins) {
                    this.plugins = [];
                }

                if(this.plugins.includes(plugin)) {
                    return;
                }

                this.plugins.push(plugin);
            }

            public async save(): Promise<void> {
                await FS.writeJSON(MAP_PATH, this.toJson());
            }
        }(data);
    }
}
