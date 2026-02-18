import {
    Controller,
    Event,
    Project,
    PROJECT_TYPE_PRESET,
    AppConfigService
} from "@wocker/core";
import {DockerService} from "@wocker/docker-module";
import {promptInput, promptSelect, volumeFormat, volumeParse} from "@wocker/utils";
import {PresetRepository} from "../repositories/PresetRepository";
import {PresetService} from "../services/PresetService";
import {injectVariables} from "../../../utils";


@Controller()
export class PresetListener {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly presetRepository: PresetRepository,
        protected readonly presetService: PresetService
    ) {}

    @Event("project:init")
    public async onInit(project: Project): Promise<void> {
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

    @Event("project:rebuild")
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

    @Event("project:beforeStart")
    protected async onBeforeStart(project: Project): Promise<void> {
        if(project.type !== PROJECT_TYPE_PRESET) {
            return;
        }

        const preset = this.presetService.get(project.preset);

        if(preset.dockerfile) {
            project.imageName = this.presetService.getImageNameForProject(project, preset);

            if(!await this.dockerService.imageExists(project.imageName)) {
                await this.dockerService.buildImage({
                    version: this.appConfigService.isExperimentalEnabled("buildKit") ? "2" : "1",
                    tag: project.imageName,
                    labels: {
                        presetName: preset.name
                    },
                    buildArgs: project.buildArgs,
                    context: preset.path,
                    dockerfile: preset.dockerfile
                });
            }
        }
    }
}
