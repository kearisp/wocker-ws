import {
    EnvConfig,
    Injectable,
    Preset,
    AppConfig,
    PresetProperties,
    FileSystem,
    PRESET_SOURCE_INTERNAL,
    PRESET_SOURCE_GITHUB,
    PRESET_SOURCE_EXTERNAL
} from "@wocker/core";
import {promptText, promptConfirm, promptSelect} from "@wocker/utils";
import md5 from "md5";
import axios from "axios";
import {Parse, Entry} from "unzipper";
import * as Path from "path";

import {AppConfigService} from "./AppConfigService";
import {LogService} from "./LogService";
import {PRESETS_DIR} from "../env";
import {FS, Http} from "../makes";


type SearchOptions = Partial<{
    name: string;
    source: string;
    path: string;
}>;

@Injectable()
export class PresetService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly logService: LogService
    ) {}

    protected toObject(config: PresetProperties): Preset {
        const _this = this;

        return new class extends Preset {
            public constructor(data: PresetProperties) {
                super(data);
            }

            public async save(): Promise<void> {
                const {
                    source,
                    path,
                    ...rest
                } = this.toJSON();

                const config = _this.appConfigService.getConfig();

                let presetData = config.presets.find((presetData): boolean => {
                    return presetData.name === this.name;
                });

                switch(this.source) {
                    case PRESET_SOURCE_EXTERNAL:
                        const fs = new FileSystem(this.path);
                        await fs.writeJSON("config.json", rest);
                        break;

                    case PRESET_SOURCE_GITHUB: {
                        const fs = new FileSystem(_this.appConfigService.dataPath("presets", this.name));

                        if(!fs.exists()) {
                            fs.mkdir("");
                        }

                        await fs.writeJSON("config.json", rest);
                        break;
                    }
                }

                if(!presetData) {
                    config.registerPreset(this.name, source, path);

                    await config.save();
                }
            }

            public async delete(): Promise<void> {
                if(this.source === PRESET_SOURCE_GITHUB) {
                    const config = _this.appConfigService.getConfig();

                    await FS.rm(_this.appConfigService.dataPath("presets", this.name), {
                        recursive: true
                    });

                    config.unregisterPreset(this.name);

                    await config.save();
                }
            }
        }(config);
    }

    protected async getList(): Promise<AppConfig["presets"]> {
        const dirs = await FS.readdir(PRESETS_DIR);
        const {presets} = this.appConfigService.getConfig();

        return [
            ...dirs.map((name: string) => {
                return {
                    name,
                    source: PRESET_SOURCE_INTERNAL as "internal",
                    path: Path.join(PRESETS_DIR, name)
                };
            }),
            ...presets.map((item) => {
                if(item.source === PRESET_SOURCE_GITHUB) {
                    item.path = this.appConfigService.dataPath("presets", item.name);
                }

                return item;
            })
        ];
    }

    public getImageName(preset: Preset, buildArgs: EnvConfig = {}): string {
        const rawValues = [];
        const hashValues = []

        Object.keys(preset.buildArgsOptions || {}).forEach((key: string) => {
            const hash = (preset.buildArgsOptions[key] || {} as any).hash || true;

            const value = buildArgs[key];

            if(hash) {
                hashValues.push(value);
            }
            else {
                rawValues.push(value);
            }
        });

        const version = [
            ...rawValues,
            md5(hashValues.join(",")).substring(0, 6)
        ].filter((value) => {
            return !!value;
        }).join("-");

        return `ws-preset-${preset.name}:${version}`;
    }

    public async init(): Promise<void> {
        let preset = await this.searchOne({
            path: this.appConfigService.pwd()
        });

        if(preset) {
            throw new Error("Preset is already registered");
        }

        const fs = new FileSystem(this.appConfigService.pwd());

        if(!fs.exists("config.json")) {
            preset = this.toObject({
                name: fs.basename(),
                version: "1.0.0",
                source: "external",
                path: this.appConfigService.pwd()
            });

            const list = await this.getList();

            preset.name = await promptText({
                message: "Preset name:",
                required: true,
                validate: async (value?: string): Promise<boolean|string> => {
                    if(!/^[a-z][a-z0-9-_]+$/.test(value || "")) {
                        return "Invalid name";
                    }

                    const presetData = list.find((presetData) => {
                        return presetData.name === value;
                    });

                    if(presetData) {
                        return "Preset name is already taken";
                    }

                    return true;
                },
                default: preset.name
            });

            preset.version = await promptText({
                message: "Preset version:",
                validate: (version?: string): string|boolean => {
                    if(!/^[0-9]+\.[0.9]+\.[0-9]+$/.test(version)) {
                        return "Invalid version";
                    }

                    return true;
                },
                default: preset.version
            });

            preset.type = await promptSelect({
                message: "Preset type:",
                options: ["dockerfile", "image"]
            });

            switch(preset.type) {
                case "dockerfile":
                    const files = await fs.readdirFiles();
                    const dockerfiles = files.filter((fileName: string): boolean => {
                        if(new RegExp("^(.*)\\.dockerfile$").test(fileName)) {
                            return true;
                        }

                        return new RegExp("^Dockerfile(\\..*)?").test(fileName);
                    });

                    if(dockerfiles.length === 0) {
                        throw new Error("No dockerfiles found");
                    }

                    preset.dockerfile = await promptSelect({
                        message: "Preset dockerfile:",
                        options: dockerfiles
                    });
                    break;

                case "image":
                    preset.image = await promptText({
                        message: "Preset image:",
                        required: true,
                        validate(value?: string): boolean|string {
                            if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/.test(value)) {
                                return "Invalid image name";
                            }

                            return true;
                        }
                    });
                    break;
            }

            console.info(JSON.stringify(preset.toJSON(), null, 4));

            const confirm = await promptConfirm({
                message: "Correct?"
            });

            if(confirm) {
                await preset.save();
            }
        }
    }

    public async get(name: string): Promise<Preset> {
        const list = await this.getList();

        const item = list.find((item) => {
            return item.name === name;
        });

        if(!item) {
            throw new Error(`Preset ${name} not found`);
        }

        const config = await FS.readJSON(item.path, "config.json");

        return this.toObject({
            ...item,
            ...config
        });
    }

    public async addPreset(name: string): Promise<void> {
        let preset = await this.searchOne({
            name
        });

        if(!preset) {
            console.info("Loading...");

            const res = await Http.get("https://raw.githubusercontent.com")
                .withHeader("User-Agent", "Wocker")
                .send(`/kearisp/wocker-${name}-preset/master/config.json`);

            preset = this.toObject(res.data);

            preset.source = PRESET_SOURCE_GITHUB;
            preset.path = this.appConfigService.dataPath("presets", preset.name);

            const zipRes = await axios.create({
                baseURL: "https://github.com",
                headers: {
                    "User-Agent": "Wocker"
                }
            }).get(`/kearisp/wocker-${preset.name}-preset/archive/refs/heads/master.zip`, {
                responseType: "stream"
            });

            FS.mkdirSync(preset.path, {
                recursive: true
            });

            zipRes.data.pipe(Parse()).on("entry", (entry: Entry): void => {
                const path = entry.path.replace(/^[^\/]+\//, "");

                if(path === "config.json") {
                    return;
                }

                const fullPath = this.appConfigService.dataPath("presets", preset.name, path);

                if(entry.type === "File") {
                    entry.pipe(
                        FS.createWriteStream(fullPath)
                    );
                }
                else if(entry.type === "Directory") {
                    FS.mkdirSync(fullPath, {
                        recursive: true
                    });
                }
            });

            await preset.save();
        }

        console.log(preset.version);
    }

    public async search(options: SearchOptions = {}): Promise<Preset[]> {
        const {
            name,
            source,
            path
        } = options;

        const presets: Preset[] = [];
        const presetConfigs = await this.getList();

        for(const presetConfig of presetConfigs) {
            if(name && name !== presetConfig.name) {
                continue;
            }

            if(source && source !== presetConfig.source) {
                continue;
            }

            if(path && path !== presetConfig.path) {
                continue;
            }

            try {
                const fullConfig = await FS.readJSON(presetConfig.path, "config.json");

                const preset = this.toObject({
                    ...presetConfig,
                    ...fullConfig
                });

                presets.push(preset);
            }
            catch(err) {
                this.logService.error("PresetService.search(", options, ") ->", err.message);
            }
        }

        return presets;
    }

    public async searchOne(options: SearchOptions = {}): Promise<Preset|null> {
        const [preset] = await this.search(options);

        return preset || null;
    }
}

// noinspection JSUnusedGlobalSymbols
export {SearchOptions as PresetServiceSearchOptions};
