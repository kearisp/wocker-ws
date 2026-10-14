import {
    Injectable,
    Inject,
    FileSystem,
    PresetServiceSearchOptions as SearchOptions,
    Preset,
    PresetProperties,
    PresetSource,
    AppService,
    LogService,
    FileSystemDriver,
    FILE_SYSTEM_DRIVER_KEY,
    Version,
    VersionRange
} from "@wocker/core";
import {PRESETS_DIR} from "../../../env";


type PresetData = {
    name?: string;
    version?: string;
    source: PresetSource;
    path?: string;
};

@Injectable()
export class PresetRepository {
    public constructor(
        protected readonly appService: AppService,
        protected readonly logService: LogService,
        @Inject(FILE_SYSTEM_DRIVER_KEY)
        protected readonly driver: FileSystemDriver
    ) {}

    protected load(data: PresetData): Preset {
        const _this = this,
              fs = new FileSystem(data.path, this.driver);

        const config = {
            ...fs.readJSON("config.json"),
            name: data.name,
            source: data.source,
            path: data.path
        };

        return new class extends Preset {
            public constructor(data: PresetProperties) {
                super(data);
            }

            // noinspection JSUnusedGlobalSymbols
            public save(): void {
                switch(this.source) {
                    case PresetSource.EXTERNAL:
                        fs.writeJSON("config.json", this.toObject());

                        _this.appService.registerPreset({
                            name: this.name,
                            source: this.source,
                            path: data.path
                        });
                        break;
                }
            }

            // noinspection JSUnusedGlobalSymbols
            public delete(): void {
                switch(this.source) {
                    case PresetSource.GITHUB:
                        if(fs.exists()) {
                            fs.rm("", {
                                recursive: true
                            });
                        }
                        break;

                    case PresetSource.EXTERNAL:
                        _this.appService.unregisterPreset(this.path);
                        break;
                }
            }
        }(config);
    }

    protected configs(): PresetData[] {
        const fs = new FileSystem(PRESETS_DIR, this.driver),
              dirs = fs.exists("") ? fs.readdir("") : [];

        const githubFs = this.appService.fs,
              githubDirs = githubFs.exists("presets")
                  ? githubFs.readdir("presets").filter((dirName) => dirName !== ".tmp")
                  : [];

        const {
            presets = []
        } = this.appService.config;

        return [
            ...dirs.map((name) => {
                return {
                    name,
                    source: PresetSource.INTERNAL,
                    path: fs.path(name)
                };
            }),
            ...githubDirs.map((dirName) => {
                const at = dirName.lastIndexOf("@");

                return {
                    name: at > 0 ? dirName.slice(0, at) : dirName,
                    version: at > 0 ? dirName.slice(at + 1) : undefined,
                    source: PresetSource.GITHUB,
                    path: githubFs.path("presets", dirName)
                };
            }),
            ...presets.filter((item) => !!item.path).map((ref) => {
                return {
                    name: ref.name,
                    source: PresetSource.EXTERNAL,
                    path: ref.path
                };
            })
        ];
    }

    protected resolveSpec(name: string): [string, string] {
        const at = name.lastIndexOf("@");

        let version: string | undefined;

        if(at > 0) {
            version = name.slice(at + 1);
            name = name.slice(0, at);
        }

        return [name, version];
    }

    public get(name: string): Preset | null {
        let version: string | undefined;
        const at = name.lastIndexOf("@");

        if(at > 0) {
            version = name.slice(at + 1);
            name = name.slice(0, at);
        }

        return this.searchOne({
            name,
            version
        });
    }

    public search(options: SearchOptions = {}): Preset[] {
        let {
            name,
            version,
            source,
            path
        } = options;

        const at = name ? name.lastIndexOf("@") : -1;

        if(at > 0) {
            version = version || name.slice(at + 1);
            name = name.slice(0, at);
        }

        const presets: Preset[] = [],
              configs = this.configs();

        for(const config of configs) {
            if(name && name !== config.name) {
                continue;
            }

            if(source && source !== config.source) {
                continue;
            }

            if(path && path !== config.path) {
                continue;
            }

            if(version && (!Version.valid(config.version) || !VersionRange.parse(version).match(config.version))) {
                continue;
            }

            try {
                const preset = this.load(config);

                presets.push(preset);
            }
            catch(err) {
                this.logService.error(err.message, {
                    name: config.name,
                    source: config.source,
                    path: config.path
                });
            }
        }

        if(name) {
            return presets.sort((a, b) => {
                return Version.parse(b.version || "0.0.0").compare(a.version || "0.0.0");
            });
        }

        return presets;
    }

    public searchOne(options: SearchOptions = {}): Preset | null {
        const presets = this.search(options);

        if(presets.length === 0) {
            return null;
        }

        return presets.reduce((best, preset) => {
            if(!Version.valid(preset.version) || !Version.valid(best.version)) {
                return best;
            }

            return Version.parse(preset.version).compare(best.version) > 0 ? preset : best;
        });
    }
}
