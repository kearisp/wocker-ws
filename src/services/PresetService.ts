import {
    EnvConfig,
    Injectable,
    Preset,
    Config,
    PresetProperties,
    AppConfigService,
    PRESET_SOURCE_INTERNAL,
    PRESET_SOURCE_GITHUB
} from "@wocker/core";
import md5 from "md5";
import axios from "axios";
import {Parse, Entry} from "unzipper";
import * as Path from "path";

import {PRESETS_DIR} from "../env";
import {FS, Http} from "../makes";


type SearchOptions = Partial<{
    name: string;
    source: string;
}>;

@Injectable()
export class PresetService {
    public constructor(
        protected readonly appConfigService: AppConfigService
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

                const config = await _this.appConfigService.getConfig();

                let presetData = config.presets.find((presetData): boolean => {
                    return presetData.name === this.name;
                });

                if(!FS.existsSync(_this.appConfigService.dataPath("presets", this.name))) {
                    FS.mkdirSync(_this.appConfigService.dataPath("presets", this.name), {
                        recursive: true
                    });
                }

                await FS.writeJSON(
                    _this.appConfigService.dataPath("presets", this.name, "config.json"),
                    rest
                );

                if(!presetData) {
                    config.registerPreset(this.name, source);

                    await config.save();
                }

                // TODO: save something...
            }

            public async delete(): Promise<void> {
                if(this.source === PRESET_SOURCE_GITHUB) {
                    const config = await _this.appConfigService.getConfig();

                    await FS.rm(_this.appConfigService.dataPath("presets", this.name), {
                        recursive: true
                    });

                    config.unregisterPreset(this.name);

                    await config.save();
                }
            }
        }(config);
    }

    protected async getList(): Promise<Config["presets"]> {
        const dirs = await FS.readdir(PRESETS_DIR);
        const {presets} = await this.appConfigService.getConfig();

        return [
            ...dirs.map((name: string) => {
                return {
                    name,
                    source: PRESET_SOURCE_INTERNAL as "internal",
                    path: Path.join(PRESETS_DIR, name)
                };
            }),
            ...presets
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

    public async get(name: string): Promise<Preset> {
        const list = await this.getList();

        const item = list.find((item) => {
            return item.name === name;
        });

        if(!item) {
            throw new Error(`Preset ${name} not found`);
        }

        if(item.source === PRESET_SOURCE_GITHUB) {
            item.path = this.appConfigService.dataPath("presets", item.name);
        }
        else if(item.source === PRESET_SOURCE_INTERNAL) {
            item.path = Path.join(PRESETS_DIR, item.name);
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
            source
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

            try {
                const fullConfig = await FS.readJSON(presetConfig.path, "config.json");

                if(!fullConfig.name) {
                    console.log(presetConfig.name);
                }

                const preset = this.toObject({
                    ...presetConfig,
                    ...fullConfig
                });

                presets.push(preset);
            }
            catch(err) {
                // TODO: log error
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
