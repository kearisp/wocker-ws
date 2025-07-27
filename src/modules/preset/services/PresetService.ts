import {
    Injectable,
    FileSystem,
    Project,
    Preset,
    PresetVariableConfig,
    EnvConfig,
    PRESET_SOURCE_EXTERNAL,
    PRESET_SOURCE_GITHUB,
    AppConfigService,
    AppFileSystemService
} from "@wocker/core";
import {promptSelect, promptInput, promptConfirm, normalizeOptions} from "@wocker/utils";
import md5 from "md5";
import {PresetRepository} from "../repositories/PresetRepository";
import {GithubClient} from "../../../makes/GithubClient";


@Injectable()
export class PresetService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly fs: AppFileSystemService,
        protected readonly presetRepository: PresetRepository
    ) {}

    public async prompt(configMap: {[name: string]: PresetVariableConfig;}, values: EnvConfig = {}) {
        for(const name in configMap) {
            const config = configMap[name];

            switch(config.type) {
                case "boolean": {
                    const value = await promptConfirm({
                        message: config.message,
                        required: config.required,
                        default: typeof values[name] !== "undefined" && values[name] === "true"
                            ? true
                            : config.default
                    });

                    values[name] = value.toString();
                    break;
                }

                case "select": {
                    const options = normalizeOptions(config.options);

                    const defaultValue = config.multiple ? options.reduce((defaultValue, option) => {
                        if(values[option.value] === "true") {
                            return [
                                ...defaultValue,
                                option.value
                            ];
                        }

                        return defaultValue;
                    }, []) : values[name];

                    const result = await promptSelect({
                        required: config.required,
                        multiple: config.multiple,
                        message: config.message,
                        options: config.options,
                        default: defaultValue
                    });

                    if(!config.multiple) {
                        values[name] = result;
                    }
                    else {
                        for(const option of options) {
                            if(result.includes(option.value)) {
                                values[option.value] = "true";
                            }
                            else if(option.value in values) {
                                delete values[option.value];
                            }
                        }
                    }
                    break;
                }

                case "int":
                case "number": {
                    const result = await promptInput({
                        ...config,
                        type: "number",
                        default: values[name] || config.default
                    });

                    values[name] = result.toString();
                    break;
                }

                case "string":
                case "text":
                case "password": {
                    values[name] = await promptInput({
                        ...config,
                        type: config.type === "string" ? "text" : config.type,
                        default: values[name] || config.default as string
                    });
                    break;
                }
            }
        }

        return values;
    }

    public getImageNameForProject(project: Project, preset: Preset): string {
        switch(project.presetMode) {
            case "project":
                return `project-${project.name}:develop`;

            default:
                return this.getImageName(preset, project.buildArgs || {});
        }
    }

    public getImageName(preset: Preset, buildArgs: EnvConfig): string {
        const rawValues = [],
              hashValues = [];

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
            (md5(hashValues.join(",")) as string).substring(0, 6)
        ].filter((value) => {
            return !!value;
        }).join("-");

        return `ws-preset-${preset.name}:${version}`;
    }

    public get(name?: string): Preset {
        const preset = name
            ? this.presetRepository.searchOne({name})
            : this.presetRepository.searchOne({path: this.appConfigService.pwd()});

        if(!preset) {
            throw new Error(name ? `Preset "${name}" not found` : "Preset not found");
        }

        return preset;
    }

    public async init(): Promise<void> {
        const fs = new FileSystem(this.appConfigService.pwd());
        let preset = this.presetRepository.searchOne({
            path: this.appConfigService.pwd()
        });

        if(preset) {
            return;
        }

        if(fs.exists("config.json")) {
            const config = fs.readJSON("config.json");

            this.appConfigService.registerPreset(config.name, PRESET_SOURCE_EXTERNAL, fs.path());
            return;
        }

        let config: any = {};

        config.name = await promptInput({
            message: "Preset name",
            required: true,
            validate: (name) => {
                if(!name || typeof name !== "string") {
                    return true;
                }

                if(this.presetRepository.searchOne({name})) {
                    return "Preset name already taken";
                }

                return true;
            }
        });

        config.version = await promptInput({
            message: "Preset version",
            validate: (version?: string): string|boolean => {
                if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
                    return "Invalid version";
                }

                return true;
            }
        });

        config.type = await promptSelect({
            message: "Preset type",
            options: ["dockerfile", "image"]
        });

        switch(config.type) {
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

                config.dockerfile = await promptSelect({
                    message: "Preset dockerfile",
                    options: dockerfiles
                });
                break;

            case "image":
                config.image = await promptInput({
                    message: "Preset image",
                    required: true,
                    validate(value?: string): boolean | string {
                        if(!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/.test(value)) {
                            return "Invalid image name";
                        }

                        return true;
                    }
                });
                break;
        }

        console.info(JSON.stringify(config, null, 4));

        const confirm = await promptConfirm({
            message: "Correct",
            default: true
        });

        if(!confirm) {
            return;
        }

        fs.writeJSON("config.json", config);

        this.appConfigService.registerPreset(config.name, PRESET_SOURCE_EXTERNAL, fs.path());
    }

    public async deinit(): Promise<void> {
        const preset = this.presetRepository.searchOne({
            path: this.appConfigService.pwd()
        });

        if(!preset) {
            return;
        }

        this.appConfigService.config.unregisterPreset(preset.name);
        this.appConfigService.save();
    }

    public async addPreset(name: string, repository?: string, version?: string): Promise<void> {
        if(!repository) {
            repository = `kearisp/wocker-${name}-preset`;
        }

        let preset = this.presetRepository.searchOne({
            name
        });

        if(!preset) {
            console.info("Loading...");

            const [owner, repo] = repository.split("/");

            const github = new GithubClient(owner, repo);

            const info = await github.getInfo();

            // const config = await github.getFile(info.default_branch, "config.json");

            await github.download(info.default_branch, this.fs.path(`presets/${name}`));

            this.appConfigService.registerPreset(name, PRESET_SOURCE_GITHUB);
        }
    }
}
