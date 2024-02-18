import md5 from "md5";

import {PRESETS_DIR} from "../env";
import {EnvConfig} from "../types";
import {DI, FS, Preset} from "../makes";


type SearchOptions = Partial<{
    name: string;
}>;

class PresetService {
    public constructor(
        di: DI
    ) {}

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

    public async get(name: string) {
        const config = await FS.readJSON(PRESETS_DIR, name, "config.json");

        return new Preset({
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


export {
    PresetService,
    SearchOptions as PresetServiceSearchOptions
};
