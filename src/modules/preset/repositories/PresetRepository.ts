import {
    AppConfig,
    Injectable,
    Inject,
    FileSystem,
    PresetServiceSearchOptions as SearchOptions,
    Preset,
    PresetProperties,
    PresetSource,
    PRESET_SOURCE_INTERNAL,
    PRESET_SOURCE_EXTERNAL,
    PRESET_SOURCE_GITHUB,
    AppConfigService,
    LogService,
    FileSystemDriver,
    FILE_SYSTEM_DRIVER_KEY
} from "@wocker/core";
import {PRESETS_DIR} from "../../../env";


type PresetData = {
    name: string;
    source: PresetSource;
    path?: string;
};

@Injectable()
export class PresetRepository {
    public constructor(
        protected readonly appConfigService: AppConfigService,
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
                    case PRESET_SOURCE_EXTERNAL:
                        fs.writeJSON("config.json", this.toObject());
                        break;
                }

                _this.appConfigService.registerPreset(this.name, this.source, data.path);
            }

            // noinspection JSUnusedGlobalSymbols
            public delete(): void {
                switch(this.source) {
                    case PRESET_SOURCE_GITHUB:
                        if(fs.exists()) {
                            fs.rm("", {
                                recursive: true
                            });
                        }
                        break;
                }

                _this.appConfigService.unregisterPreset(this.name);
            }
        }(config);
    }

    protected configs(): AppConfig["presets"] {
        const fs = new FileSystem(PRESETS_DIR, this.driver),
              dirs = fs.exists("") ? fs.readdir("") : [];

        const {
            presets = []
        } = this.appConfigService.config;

        return [
            ...dirs.map((name) => {
                return {
                    name,
                    source: PRESET_SOURCE_INTERNAL,
                    path: fs.path(name)
                };
            }),
            ...presets.map((item) => {
                if(item.source === PRESET_SOURCE_GITHUB) {
                    return {
                        ...item,
                        path: this.appConfigService.fs.path("presets", item.name)
                    };
                }

                return item;
            })
        ];
    }

    public search(options: SearchOptions = {}): Preset[] {
        const {
            name,
            source,
            path
        } = options;

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

        return presets;
    }

    public searchOne(options: SearchOptions = {}): Preset | null {
        const [preset] = this.search(options);

        return preset || null;
    }
}
