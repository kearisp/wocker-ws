import {MAP_PATH} from "src/env";
import {FS} from "src/makes";


type TypeMap = {
    [type: string]: string;
};

class AppConfigService {
    protected pwd: string;
    protected mapTypes: TypeMap = {
        image: "Image",
        dockerfile: "Dockerfile"
    };

    public constructor() {
        this.pwd = (process.cwd() || process.env.PWD);
    }

    public getPWD() {
        return this.pwd;
    }

    public setPWD(pwd: string) {
        this.pwd = pwd;
    }

    public async getAllEnvVariables() {
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

    public registerProjectType(name: string, title?: string) {
        this.mapTypes[name] = title || name;
    }

    public getProjectTypes() {
        return this.mapTypes;
    }
}

export {AppConfigService};
