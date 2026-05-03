import {
    Injectable,
    Project,
    Preset,
    PresetVariableConfig,
    EnvConfig,
    PRESET_SOURCE_EXTERNAL,
    PRESET_SOURCE_GITHUB,
    AppService,
    ProcessService,
    AppFileSystemService,
    Version,
    VersionRule
} from "@wocker/core";
import {promptSelect, promptInput, promptConfirm, normalizeOptions} from "@wocker/prompts";
import crypto from "crypto";
import {PresetRepository} from "../repositories/PresetRepository";
import {GithubBranch, GithubClient, GithubTag} from "../../../makes/GithubClient";


@Injectable()
export class PresetService {
    protected range = "1.x.x";

    public constructor(
        protected readonly appService: AppService,
        protected readonly processService: ProcessService,
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
            crypto.createHash("md5").update(hashValues.join(","), "utf8").digest("hex").substring(0, 6)
        ].filter((value) => {
            return !!value;
        }).join("-");

        return `ws-preset-${preset.name}:${version}`;
    }

    public get(name?: string): Preset {
        const preset = name
            ? this.presetRepository.searchOne({name})
            : this.presetRepository.searchOne({path: this.processService.pwd()});

        if(!preset) {
            throw new Error(name ? `Preset "${name}" not found` : "Preset not found");
        }

        return preset;
    }

    public async init(): Promise<void> {
        const fs = this.fs.cd(this.processService.pwd());
        let preset = this.presetRepository.searchOne({
            path: this.processService.pwd()
        });

        if(preset) {
            return;
        }

        if(fs.exists("config.json")) {
            const config = fs.readJSON("config.json");

            this.appService.registerPreset(config.name, PRESET_SOURCE_EXTERNAL, fs.path());
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

        this.appService.registerPreset(config.name, PRESET_SOURCE_EXTERNAL, fs.path());
    }

    public async deinit(): Promise<void> {
        const preset = this.presetRepository.searchOne({
            path: this.processService.pwd()
        });

        if(!preset) {
            return;
        }

        this.appService.unregisterPreset(preset.name);
    }

    public async install(repository: string, version?: string): Promise<void> {
        if(!/^[\w-]+\/[\w-]+$/.test(repository)) {
            repository = `kearisp/wocker-${repository}-preset`;
        }

        const [owner, name] = repository.split("/");

        let satisfyingTag: GithubTag;
        let satisfyingBranch: GithubBranch;

        const github = new GithubClient(owner, name),
              wRule = VersionRule.parse(this.range),
              rule = VersionRule.parse(["latest", "beta"].includes(version) ? "x" : version ?? this.range);

        if(version !== "beta") {
            satisfyingTag = (await github.getTags())
                .filter((tag) => {
                    if(!Version.valid(tag.name)) {
                        return false;
                    }

                    return wRule.match(tag.name) || rule.match(tag.name);
                })
                .reduce((tag: GithubTag | null, nextTag: GithubTag) => {
                    if(!tag) {
                        return nextTag;
                    }

                    return Version.parse(tag.name).compare(nextTag.name) < 0 ? nextTag : tag;
                }, null);
        }

        if(!satisfyingTag) {
            satisfyingBranch = (await github.getBranches())
                .filter((branch) => {
                    if(!Version.valid(branch.name)) {
                        return false;
                    }

                    return wRule.match(branch.name) || rule.match(branch.name);
                })
                .reduce((branch: GithubBranch | null, nextBranch) => {
                    if(!branch) {
                        return nextBranch;
                    }

                    return Version.parse(branch.name).compare(nextBranch.name) < 0 ? nextBranch : branch;
                }, null);
        }

        if(!satisfyingTag && !satisfyingBranch) {
            throw new Error(`Version "${version}" not found`);
        }

        try {
            const ref = satisfyingTag ? satisfyingTag.name : satisfyingBranch.name,
                  config = await github.getFile(ref, "config.json");

            console.info(`Loading "${ref}"...`);

            let preset = this.presetRepository.searchOne({
                name: config.name
            });

            if(preset && satisfyingTag && preset.source === PRESET_SOURCE_GITHUB && Version.parse(ref).compare(preset.version) === 0) {
                console.info("Preset already installed");
                return;
            }

            if(this.fs.exists(`presets/.tmp/${config.name}`)) {
                this.fs.rm(`presets/.tmp/${config.name}`, {
                    recursive: true
                });
            }

            await github.download(ref, this.fs.path(`presets/.tmp/${config.name}`));

            if(this.fs.exists(`presets/${config.name}`)) {
                this.fs.rm(`presets/${config.name}`, {
                    recursive: true
                });
            }

            this.fs.mv(`presets/.tmp/${config.name}`, `presets/${config.name}`);

            this.appService.registerPreset(config.name, PRESET_SOURCE_GITHUB);

            console.info("Preset installed successfully");
        }
        finally {
            if(this.fs.exists("presets/.tmp")) {
                this.fs.rm("presets/.tmp", {
                    recursive: true
                });
            }
        }
    }
}
