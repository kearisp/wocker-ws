import {
    Injectable,
    Project,
    Preset,
    PresetVariableConfig,
    PresetSelectMode,
    EnvConfig,
    PresetSource,
    AppService,
    ProcessService,
    AppFileSystemService,
    Version,
    VersionRange
} from "@wocker/core";
import {promptSelect, promptInput, promptConfirm, normalizeOptions} from "@wocker/prompts";
import crypto from "crypto";
import {PresetRepository} from "../repositories/PresetRepository";
import {GithubBranch, GithubClient, GithubTag} from "../../../makes/GithubClient";


@Injectable()
export class PresetService {
    public constructor(
        protected readonly appService: AppService,
        protected readonly processService: ProcessService,
        protected readonly fs: AppFileSystemService,
        protected readonly presetRepository: PresetRepository
    ) {}

    protected get range(): string {
        if(this.appService.isExperimentalEnabled("presetV2")) {
            return "1.x.x || 2.x.x"
        }

        return "1.x.x";
    }

    protected getSelectMode(preset: Preset, config: PresetVariableConfig): PresetSelectMode | undefined {
        if(config.type !== "select") {
            return undefined;
        }

        return config.mode || (Version.parse(preset.version).major >= 2 ? "variable" : "flags");
    }

    protected getSelectDelimiter(config: PresetVariableConfig): string {
        return config.type === "select" && config.delimiter || ";";
    }

    public async prompt(preset: Preset, configMap: {[name: string]: PresetVariableConfig;}, values: EnvConfig = {}) {
        for(const name in configMap) {
            const config = configMap[name];

            if(config.when) {
                const {
                    variable,
                    equals,
                    notEquals,
                    in: inList,
                    notIn,
                    contains,
                    includes
                } = config.when;

                const value = values[variable];

                const variableConfig = configMap[variable];
                const isMultipleSelect = variableConfig?.type === "select"
                    && variableConfig.multiple
                    && this.getSelectMode(preset, variableConfig) === "variable";
                const valueList = isMultipleSelect
                    ? (value ? value.split(this.getSelectDelimiter(variableConfig)) : [])
                    : [value];
                const includesList = Array.isArray(includes) ? includes : [includes];

                if(
                    (typeof equals !== "undefined" && value !== equals) ||
                    (typeof notEquals !== "undefined" && value === notEquals) ||
                    (typeof inList !== "undefined" && !inList.includes(value)) ||
                    (typeof notIn !== "undefined" && notIn.includes(value)) ||
                    (typeof contains !== "undefined" && !(value || "").includes(contains)) ||
                    (typeof includes !== "undefined" && !includesList.every((item) => valueList.includes(item)))
                ) {
                    delete values[name];
                    continue;
                }
            }

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
                    if(this.getSelectMode(preset, config) === "variable") {
                        const delimiter = this.getSelectDelimiter(config);

                        const defaultValue = config.multiple
                            ? values[name]?.split(delimiter) || []
                            : values[name];

                        const result = await promptSelect({
                            message: config.message,
                            multiple: config.multiple,
                            options: config.options,
                            default: defaultValue as any
                        });

                        values[name] = config.multiple
                            ? (result as unknown as string[]).join(delimiter)
                            : result as string;
                    }
                    else {
                        const options = normalizeOptions(config.options);

                        const defaultValue = config.multiple
                            ? options.reduce((defaultValue, option) => {
                                if(values[option.value] === "true") {
                                    return [
                                        ...defaultValue,
                                        option.value
                                    ];
                                }

                                return defaultValue;
                            }, [])
                            : values[name];

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
        let version: string | undefined;

        if(name) {
            const at = name.lastIndexOf("@");

            if(at > 0) {
                version = name.slice(at + 1);
                name = name.slice(0, at);
            }
        }

        const preset = name
            ? this.presetRepository.searchOne({name, version})
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

            this.appService.registerPreset({
                name: config.name,
                source: PresetSource.EXTERNAL,
                path: fs.path()
            });
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

        this.appService.registerPreset({
            name: config.name,
            source: PresetSource.EXTERNAL,
            path: fs.path()
        });
    }

    public async deinit(): Promise<void> {
        const preset = this.presetRepository.searchOne({
            path: this.processService.pwd()
        });

        if(!preset) {
            return;
        }

        this.appService.unregisterPreset(preset.path);
    }

    public async install(repository: string, version?: string): Promise<void> {
        if(!/^[\w-]+\/[\w-]+$/.test(repository)) {
            repository = `kearisp/wocker-${repository}-preset`;
        }

        const [owner, name] = repository.split("/");

        let satisfyingTag: GithubTag;
        let satisfyingBranch: GithubBranch;

        const github = new GithubClient(owner, name),
              wRule = VersionRange.parse(this.range),
              rule = VersionRange.parse(["latest", "beta"].includes(version) ? "x" : version ?? this.range);

        if(version !== "beta") {
            satisfyingTag = (await github.getTags())
                .filter((tag) => {
                    if(!Version.valid(tag.name)) {
                        return false;
                    }

                    return wRule.match(tag.name) && rule.match(tag.name);
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

                    return wRule.match(branch.name) && rule.match(branch.name);
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

            this.processService.write(`Loading "${ref}"...\n`);

            const legacyDir = `presets/${config.name}`,
                  targetDir = `presets/${config.name}@${config.version}`;

            const installed = this.presetRepository.search({
                name: config.name,
                source: PresetSource.GITHUB
            });

            const alreadyInstalled = installed.some((preset) => {
                return Version.valid(preset.version) && Version.parse(preset.version).compare(ref) === 0;
            });

            if(satisfyingTag && alreadyInstalled) {
                this.processService.write("Preset already installed\n");
                return;
            }

            if(this.fs.exists(`${legacyDir}/config.json`)) {
                const legacyConfig = this.fs.readJSON(`${legacyDir}/config.json`),
                      migratedDir = `presets/${config.name}@${legacyConfig.version}`;

                if(!this.fs.exists(migratedDir)) {
                    this.fs.mv(legacyDir, migratedDir);
                }
            }

            if(this.fs.exists(`presets/.tmp/${config.name}`)) {
                this.fs.rm(`presets/.tmp/${config.name}`, {
                    recursive: true
                });
            }

            await github.download(ref, this.fs.path(`presets/.tmp/${config.name}`));

            if(this.fs.exists(targetDir)) {
                this.fs.rm(targetDir, {
                    recursive: true
                });
            }

            this.fs.mv(`presets/.tmp/${config.name}`, targetDir);

            this.processService.write("Preset installed successfully\n");
        }
        finally {
            if(this.fs.exists("presets/.tmp")) {
                this.fs.rm("presets/.tmp", {
                    recursive: true
                });
            }
        }
    }

    public async uninstall(name: string, version?: string): Promise<void> {
        const preset = this.presetRepository.searchOne({
            name,
            version,
            source: PresetSource.GITHUB
        });

        if(!preset) {
            throw new Error("Preset not found");
        }

        this.fs.rm(`presets/${preset.name}@${preset.version}`, {
            recursive: true
        });
    }
}
