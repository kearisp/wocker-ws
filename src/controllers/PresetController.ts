import {Controller, Command, Option, Project} from "@wocker/core";
import {promptSelect, promptGroup, promptText, promptConfig} from "@wocker/utils";
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
        this.appConfigService.registerProjectType("preset", "Preset");

        this.appEventsService.on("project:init", (project) => this.onInit(project));
        this.appEventsService.on("project:beforeStart", (project) => this.onBeforeStart(project));
        this.appEventsService.on("project:rebuild", (project) => this.onRebuild(project));
    }

    public async presets() {
        const presets = await this.presetService.search();

        return presets.map((preset) => {
            return preset.name;
        });
    }

    protected async onInit(project: Project) {
        if(project.type !== "preset") {
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
                    destination,
                    options
                } = volumeParse(volume);

                let projectVolume = project.getVolumeByDestination(destination);

                const source = await promptText({
                    message: "Volume",
                    suffix: `:${destination}`,
                    default: projectVolume ? volumeParse(projectVolume).source : "./"
                });

                projectVolume = volumeFormat({
                    source,
                    destination,
                    options
                });

                project.volumeMount(projectVolume);
            }
        }

        if(preset.dockerfile) {
            project.imageName = preset.getImageName(project.buildArgs);
        }
    }

    protected async onRebuild(project: Project) {
        if(project.type !== "preset") {
            return;
        }

        const preset = await this.presetService.get(project.preset);

        if(!preset) {
            throw new Error(`Preset ${project.preset} not found`);
        }

        const imageName = preset.getImageName(project.buildArgs || {});
        const exists = await this.dockerService.imageExists(imageName);

        if(exists) {
            console.info(`Removing image: ${imageName}`);

            await this.dockerService.imageRm(imageName);
        }
    }

    protected async onBeforeStart(project: Project) {
        if(project.type !== "preset") {
            return;
        }

        const preset = await this.presetService.get(project.preset);

        if(preset.dockerfile) {
            project.imageName = preset.getImageName(project.buildArgs);

            if(!await this.dockerService.imageExists(project.imageName)) {
                await this.dockerService.buildImage({
                    tag: project.imageName,
                    labels: {
                        presetName: preset.name
                    },
                    buildArgs: project.buildArgs,
                    context: Path.join(PRESETS_DIR, preset.name),
                    src: preset.dockerfile
                });
            }
        }
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
    ) {
        const preset = await this.presetService.get(presetName);

        let buildArgs: Project["buildArgs"] = {};

        if(preset.buildArgsOptions) {
            buildArgs = await promptGroup(preset.buildArgsOptions);
        }

        const imageName = preset.getImageName(buildArgs);

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
