import {
    Controller,
    Command,
    Param,
    Option,
    Project,
    FSManager,
    PROJECT_TYPE_PRESET
} from "@wocker/core";
import {promptSelect, promptGroup, promptText, promptConfig} from "@wocker/utils";
import {promptConfirm} from "@wocker/utils";
import * as Path from "path";

import {PRESETS_DIR} from "../env";
import {injectVariables, volumeParse, volumeFormat} from "../utils";
import {
    AppConfigService,
    AppEventsService,
    ProjectService,
    PresetService,
    DockerService
} from "../services";


@Controller()
export class PresetController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly projectService: ProjectService,
        protected readonly presetService: PresetService,
        protected readonly dockerService: DockerService
    ) {
        this.appEventsService.on("project:init", (project) => this.onInit(project));
        this.appEventsService.on("project:beforeStart", (project) => this.onBeforeStart(project));
        this.appEventsService.on("project:rebuild", (project) => this.onRebuild(project));
    }

    public async presets(): Promise<string[]> {
        const presets = await this.presetService.search();

        return presets.map((preset) => {
            return preset.name;
        });
    }

    protected async onInit(project: Project): Promise<void> {
        if(project.type !== PROJECT_TYPE_PRESET) {
            return;
        }

        const presets = await this.presetService.search();

        if(presets.length === 0) {
            throw new Error("No presets");
        }

        project.preset = await promptSelect({
            message: "Choose preset:",
            options: presets.map((preset) => {
                return {
                    label: preset.name,
                    value: preset.name
                };
            }),
            default: project.preset
        });

        project.presetMode = await promptSelect({
            message: "Preset mode:",
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

        const preset = await this.presetService.get(project.preset);

        if(!preset) {
            throw new Error("Preset not found");
        }

        if(preset.buildArgsOptions) {
            project.buildArgs = await promptConfig(preset.buildArgsOptions, project.buildArgs);
        }

        if(preset.envOptions) {
            project.env = await promptConfig(preset.envOptions, project.env);
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

                const newSource = await promptText({
                    message: "Volume:",
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

        const preset = await this.presetService.get(project.preset);

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

        const preset = await this.presetService.get(project.preset);

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
    public async init(): Promise<void> {
        await this.presetService.init();
    }

    @Command("preset:deinit")
    public async deinit(): Promise<void> {
        await this.presetService.deinit();
    }

    @Command("preset:add <preset>")
    public async add(
        @Param("preset")
        name: string
    ): Promise<void> {
        await this.presetService.addPreset(name);
    }

    @Command("preset:delete <preset>")
    public async delete(
        @Param("preset")
        name: string,
        @Option("yes", {
            alias: "y",
            description: "Confirm deletion"
        })
        confirm?: boolean
    ): Promise<void> {
        const preset = await this.presetService.get(name);

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

        await preset.delete();
    }

    @Command("preset:eject")
    public async eject(
        @Option("name", {
            type: "string",
            alias: "n",
            description: "Project name"
        })
        name?: string
    ): Promise<void> {
        if(name) {
            await this.projectService.cdProject(name);
        }

        const project = await this.projectService.get();
        const preset = await this.presetService.get(project.preset);

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

        const copier = new FSManager(
            this.appConfigService.presetPath(preset.name),
            this.appConfigService.pwd()
        );

        if(preset.dockerfile) {
            if(!copier.destination.exists(preset.dockerfile)) {
                await copier.copy(preset.dockerfile);
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

            await copier.copy(path);
        }

        delete project.preset;
        delete project.imageName;

        await project.save();
    }

    @Command("preset:build <preset>")
    public async build(
        @Option("rebuild", {
            type: "boolean",
            alias: "r",
            description: "Rebuild image"
        })
        rebuild: boolean,
        presetName: string
    ): Promise<void> {
        const preset = await this.presetService.get(presetName);

        let buildArgs: Project["buildArgs"] = {};

        if(preset.buildArgsOptions) {
            buildArgs = await promptGroup(preset.buildArgsOptions);
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
