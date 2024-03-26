import {EnvConfig} from "@wocker/core";
import md5 from "md5";

import {PRESETS_DIR} from "../env";
import {FS, Preset} from "../makes";


type SearchOptions = Partial<{
    name: string;
}>;

export class PresetService {
    public constructor() {
        Preset.install(this);
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
            md5(hashValues.join(",")).substr(0, 6)
        ].filter((value) => {
            return !!value;
        }).join("-");

        return `ws-preset-${preset.name}:${version}`;
    }

    public async save(preset: Preset): Promise<void> {
        //
    }

    public async get(name: string): Promise<Preset> {
        const config = await FS.readJSON(PRESETS_DIR, name, "config.json");

        return new class extends Preset {
            public constructor(
                protected readonly presetService: PresetService,
                data: any
            ) {
                super(data);
            }

            public async save() {
                //
            }
        }(this, {
            name,
            ...config
        });
    }

    public async search(options: SearchOptions = {}) {
        const {
            name
        } = options;

        const presets: Preset[] = [];

        const dirs = await FS.readdir(PRESETS_DIR);

        for(const dir of dirs) {
            if(name && name !== dir) {
                continue;
            }

            const config = await FS.readJSON(PRESETS_DIR, dir, "config.json");

            const preset = new Preset({
                name: dir,
                ...config
            });

            presets.push(preset);
        }

        return presets;
    }

    public async searchOne(options: SearchOptions = {}): Promise<Preset|null> {
        const [preset] = await this.search(options);

        return preset || null;
    }
}

export {SearchOptions as PresetServiceSearchOptions};
