import {
    Injectable,
    AppConfig,
    AppConfigProperties,
    AppConfigService as CoreAppConfigService,
    FileSystem,
    PROJECT_TYPE_PRESET,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE
} from "@wocker/core";
import * as Path from "path";
import {WOCKER_VERSION, DATA_DIR, PRESETS_DIR} from "../env";


type TypeMap = {
    [type: string]: string;
};

@Injectable("APP_CONFIG")
export class AppConfigService extends CoreAppConfigService {
    protected _pwd: string;
    protected _fs?: FileSystem;
    protected _config?: AppConfig;

    protected readonly mapTypes: TypeMap = {
        [PROJECT_TYPE_IMAGE]: "Image",
        [PROJECT_TYPE_DOCKERFILE]: "Dockerfile",
        [PROJECT_TYPE_PRESET]: "Preset"
    };

    public constructor() {
        super();

        this._pwd = (process.cwd() || process.env.PWD) as string;
    }

    public get version(): string {
        return WOCKER_VERSION;
    }

    public get config(): AppConfig {
        if(!this._config) {
            const fs = this.fs;

            let data: AppConfigProperties = {};

            if(fs.exists("wocker.config.js")) {
                try {
                    const {config} = require(fs.path("wocker.config.js"));

                    data = config;
                }
                catch(err) {
                    // TODO: Log somehow

                    if(fs.exists("wocker.config.json")) {
                        let json = fs.readJSON("wocker.config.json");

                        if(typeof json === "string") {
                            json = JSON.parse(json);
                        }

                        data = json;
                    }
                }
            }
            else if(fs.exists("wocker.config.json")) {
                data = fs.readJSON("wocker.config.json");
            }
            else if(fs.exists("wocker.json")) {
                let json = fs.readJSON("wocker.json");

                if(typeof json === "string") {
                    json = JSON.parse(json);
                }

                data = json;
            }
            else if(fs.exists("data.json")) {
                data = fs.readJSON("data.json");
            }
            else if(!fs.exists()) {
                fs.mkdir("", {
                    recursive: true
                });
            }

            this._config = new AppConfig(data);
        }

        return this._config;
    }

    public get projects() {
        return this.config.projects;
    }

    public get fs(): FileSystem {
        if(!this._fs) {
            this._fs = new FileSystem(DATA_DIR);
        }

        return this._fs;
    }

    public pwd(...parts: string[]): string {
        return Path.join(this._pwd, ...parts);
    }

    public setPWD(pwd: string): void {
        this._pwd = pwd;
    }

    public dataPath(...parts: string[]): string {
        return Path.join(DATA_DIR, ...parts);
    }

    public presetPath(...parts: string[]): string {
        return Path.join(PRESETS_DIR, ...parts);
    }

    public getProjectTypes(): TypeMap {
        return this.mapTypes;
    }

    public addProject(id: string, name: string, path: string): void {
        this.config.addProject(id, name, path);
    }

    public removeProject(name: string) {
        return this.config.removeProject(name);
    }

    public save(): void {
        const fs = this.fs;

        if(!fs.exists()) {
            fs.mkdir("", {
                recursive: true
            });
        }

        fs.writeFile("wocker.config.js", this.config.toJsString());
        fs.writeFile("wocker.config.json", this.config.toString()); // Backup file

        if(fs.exists("data.json")) {
            fs.rm("data.json");
        }

        if(fs.exists("wocker.json")) {
            fs.rm("wocker.json");
        }
    }
}
