import {
    AppConfigService as CoreAppConfigService,
    AppConfig,
    EnvConfig
} from "@wocker/core";
import * as Path from "path";

import {MAP_PATH, DATA_DIR, PLUGINS_DIR} from "../env";
import {FS} from "../makes";


type TypeMap = {
    [type: string]: string;
};

class AppConfigService extends CoreAppConfigService {
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

    public async getAppConfig(): Promise<AppConfig> {
        return FS.readJSON(MAP_PATH);
    }

    private async saveAppConfig(config: AppConfig) {
        await FS.writeJSON(MAP_PATH, config);
    }

    public async getMeta(name: string, defaultValue?: string) {
        const config = await this.getAppConfig();

        const value = (config.meta || {})[name];

        if(!value) {
            return defaultValue;
        }

        return value;
    }

    public async setMeta(name: string, value?: string | number) {
        const config = await this.getAppConfig();

        if(!config.meta) {
            config.meta = {};
        }

        config.meta[name] = value ? value.toString() : undefined;

        await this.saveAppConfig(config);
    }

    public async getAllEnvVariables(): Promise<EnvConfig> {
        const {
            env = {}
        } = await FS.readJSON(MAP_PATH);

        return env;
    }

    public async getEnvVariable(name: string, defaultValue?: string) {
        const {
            [name]: value = defaultValue
        } = await this.getAllEnvVariables();

        if(value === null) {
            return defaultValue;
        }

        return value;
    }

    public async setEnv(env: any) {
        const config = await FS.readJSON(MAP_PATH);

        await FS.writeJSON(MAP_PATH, {
            ...config,
            env: {
                ...config.env || {},
                ...env
            }
        });
    }

    public async setEnvVariable(name: string, value: string | number) {
        const config = await FS.readJSON(MAP_PATH);

        await FS.writeJSON(MAP_PATH, {
            ...config,
            env: {
                ...config.env || {},
                [name]: value
            }
        });
    }

    public async unsetEnv(...keys: string[]) {
        const config = await FS.readJSON(MAP_PATH);

        await FS.writeJSON(MAP_PATH, {
            ...config,
            env: Object.keys(config.env || {}).reduce((res, key) => {
                if(!keys.includes(key)) {
                    res[key] = config.env[key];
                }

                return res;
            }, {})
        });
    }

    public getProjectTypes() {
        return this.mapTypes;
    }

    public registerProjectType(name: string, title?: string) {
        this.mapTypes[name] = title || name;
    }

    public async setProjectConfig(id: string, path: string) {
        const {
            projects,
            ...rest
        } = await this.getAppConfig();

        await FS.writeJSON(MAP_PATH, {
            ...rest,
            projects: [
                ...(projects || []).filter((project) => {
                    return project.id !== id;
                }).filter((project) => {
                    return project.src !== path;
                }),
                {
                    id: id,
                    src: path
                }
            ]
        });
    }

    public async activatePlugin(name: string) {
        const {default: Plugin} = await import(name);

        // this.use
        if(!Plugin) {
            throw new Error("No plugin");
        }

        const {
            plugins = [],
            ...rest
        } = await this.getAppConfig();

        await FS.writeJSON(MAP_PATH, {
            plugins: [
                ...plugins.filter((plugin: string) => {
                    return plugin !== name;
                }),
                name
            ],
            ...rest
        });
    }

    public async deactivatePlugin(name: string) {
        const {
            plugins = [],
            ...rest
        } = await this.getAppConfig();

        if(!plugins.includes(name)) {
            return;
        }

        await FS.writeJSON(MAP_PATH, {
            plugins: plugins.filter((plugin: string) => {
                return plugin !== name;
            }),
            ...rest
        });
    }
}


export {AppConfigService};
