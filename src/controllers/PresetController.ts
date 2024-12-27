import {
    Controller,
    Command,
    Description,
    Param,
    Option,
    Project,
    FileSystemManager,
    PROJECT_TYPE_PRESET, PRESET_SOURCE_EXTERNAL
} from "@wocker/core";
import {promptSelect, promptInput} from "@wocker/utils";
import {promptConfirm, volumeFormat, volumeParse} from "@wocker/utils";
import * as Path from "path";
import CliTable from "cli-table3";
import {PRESETS_DIR} from "../env";
import {injectVariables} from "../utils";
import {
    PresetRepository
} from "../repositories";
import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    PresetService,
    DockerService
} from "../services";


@Controller()
@Description("Preset commands")
export class PresetController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly presetService: PresetService,
        protected readonly presetRepository: PresetRepository,
        protected readonly dockerService: DockerService
    ) {
        this.appEventsService.on("project:init", (project) => this.onInit(project));
        this.appEventsService.on("project:beforeStart", (project) => this.onBeforeStart(project));
        this.appEventsService.on("project:rebuild", (project) => this.onRebuild(project));
    }

    public async presets(): Promise<string[]> {
        const presets = this.presetRepository.search();

        return presets.map((preset) => {
            return preset.name;
        });
    }

    protected async onInit(project: Project): Promise<void> {
        if(project.type !== PROJECT_TYPE_PRESET) {
            return;
        }

        const presets = this.presetRepository.search();

        if(presets.length === 0) {
            throw new Error("No presets");
        }

        project.preset = await promptSelect({
            message: "Choose preset",
            options: presets.map((preset) => {
                return {
                    label: preset.name,
                    value: preset.name
                };
            }),
            default: project.preset
        });

        project.presetMode = await promptSelect({
            message: "Preset mode",
            options: [
                {
                    label: "For project only",
                    value: "project"
                },
                {
                    label: "Global usage",
                    value: "global"
                }
            ],
            default: project.presetMode
        });

        const preset = this.presetService.get(project.preset);

        if(!preset) {
            throw new Error("Preset not found");
        }

        if(preset.buildArgsOptions) {
            project.buildArgs = await this.presetService.prompt(preset.buildArgsOptions, project.buildArgs);
        }

        if(preset.envOptions) {
            project.env = await this.presetService.prompt(preset.envOptions, project.env);
        }

        if(preset.volumeOptions) {
            for(let volume of preset.volumeOptions) {
                volume = injectVariables(volume, {
                    ...project.buildArgs || {},
                    ...project.env || {}
                });

                const {
                    source,
                    destination,
                    options
                } = volumeParse(volume);

                let projectVolume = project.getVolumeByDestination(destination);

                const newSource = await promptInput({
                    message: "Volume",
                    required: true,
                    suffix: `:${destination}`,
                    default: projectVolume ? volumeParse(projectVolume).source : source
                });

                projectVolume = volumeFormat({
                    source: newSource,
                    destination,
                    options
                });

                project.volumeMount(projectVolume);
            }
        }

        if(preset.dockerfile) {
            project.imageName = this.presetService.getImageNameForProject(project, preset);
        }
    }

    protected async onRebuild(project: Project): Promise<void> {
        if(project.type !== PROJECT_TYPE_PRESET) {
            return;
        }

        const preset = this.presetService.get(project.preset);

        if(!preset) {
            throw new Error(`Preset ${project.preset} not found`);
        }

        const imageName = this.presetService.getImageNameForProject(project, preset);
        const exists = await this.dockerService.imageExists(imageName);

        if(exists) {
            console.info(`Removing image: ${imageName}`);

            await this.dockerService.imageRm(imageName);
        }
    }

    protected async onBeforeStart(project: Project): Promise<void> {
        if(project.type !== PROJECT_TYPE_PRESET) {
            return;
        }

        const preset = this.presetService.get(project.preset);

        if(preset.dockerfile) {
            project.imageName = this.presetService.getImageNameForProject(project, preset);

            if(!await this.dockerService.imageExists(project.imageName)) {
                await this.dockerService.buildImage({
                    tag: project.imageName,
                    labels: {
                        presetName: preset.name
                    },
                    buildArgs: project.buildArgs,
                    context: preset.path,
                    src: preset.dockerfile
                });
            }
        }
    }

    @Command("preset:init")
    @Description("Creates preset config for current dir")
    public async init(): Promise<void> {
        await this.presetService.init();
    }

    @Command("preset:destroy")
    public async destroy(): Promise<void> {
        await this.presetService.deinit();
    }

    @Command("preset:install <preset>")
    @Command("preset:install <preset>@<version>")
    @Description("Adding preset from github repository")
    public async add(
        @Param("preset")
        name: string,
        @Param("version")
        version?: string
    ): Promise<void> {
        await this.presetService.addPreset(name, version);
    }

    @Command("preset:ls")
    @Description("List of all available presets")
    public async list(): Promise<string> {
        const presets = this.presetRepository.search();

        const table = new CliTable({
            head: [
                "Name",
                "Source",
                "Path"
            ]
        });

        for(const preset of presets) {
            table.push([
                preset.name,
                preset.source,
                preset.source === PRESET_SOURCE_EXTERNAL ? preset.path : ""
            ]);
        }

        return table.toString();
    }

    @Command("preset:delete <preset>")
    public async delete(
        @Param("preset")
        name: string,
        @Option("yes", "y")
        @Description("Confirm deletion")
        confirm?: boolean
    ): Promise<void> {
        const preset = this.presetService.get(name);

        if(typeof confirm === "undefined" || confirm === null) {
            confirm = await promptConfirm({
                message: `Delete preset ${name}?`,
                default: false
            });
        }

        if(!confirm) {
            return;
        }

        console.info("Deleting...");

        preset.delete();
    }

    @Command("preset:eject")
    @Description("Eject preset files into the project")
    public async eject(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        if(name) {
            this.projectService.cdProject(name);
        }

        const project = this.projectService.get();
        const preset = this.presetService.get(project.preset);

        if(!preset) {
            throw new Error("Preset not found");
        }

        const confirm = await promptConfirm({
            message: "Confirm eject",
            default: false
        });

        if(!confirm) {
            return;
        }

        const copier = new FileSystemManager(
            this.appConfigService.presetPath(preset.name),
            this.appConfigService.pwd()
        );

        if(preset.dockerfile) {
            if(!copier.destination.exists(preset.dockerfile)) {
                copier.copy(preset.dockerfile);
            }

            project.type = "dockerfile";
            project.dockerfile = preset.dockerfile;
        }

        const files = await copier.source.readdirFiles("", {
            recursive: true
        } as any);

        for(const path of files) {
            const stat = copier.source.stat(path),
                dir = Path.dirname(path);

            if(stat.isFile() && path === "config.json") {
                continue;
            }

            if(stat.isFile() && path === preset.dockerfile) {
                continue;
            }

            if(copier.destination.exists(path)) {
                continue;
            }

            if(!copier.destination.exists(dir)) {
                copier.destination.mkdir(dir, {
                    recursive: true
                } as any);
            }

            copier.copy(path);
        }

        delete project.preset;
        delete project.imageName;

        project.save();
    }

    @Command("preset:build <preset>")
    @Description("Build docker image form a preset")
    public async build(
        @Param("preset")
        presetName: string,
        @Option("rebuild", "r")
        @Description("Rebuild image")
        rebuild?: boolean
    ): Promise<void> {
        const preset = this.presetService.get(presetName);

        let buildArgs: Project["buildArgs"] = {};

        if(preset.buildArgsOptions) {
            buildArgs = await this.presetService.prompt(preset.buildArgsOptions);
        }

        const imageName = this.presetService.getImageName(preset, buildArgs);

        if(rebuild) {
            await this.dockerService.imageRm(imageName);
        }

        await this.dockerService.buildImage({
            tag: imageName,
            labels: {
                presetName: preset.name
            },
            buildArgs: buildArgs,
            context: Path.join(PRESETS_DIR, preset.name),
            src: preset.dockerfile
        });
    }
}
