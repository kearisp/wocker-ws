import {Cli} from "@kearisp/cli";
import * as Path from "path";

import {ROOT_DIR, PRESETS_DIR} from "src/env";
import {
    Plugin,
    FS,
    Docker,
    Logger
} from "src/makes";
import {Project, Preset} from "src/models";
import {
    AppConfigService,
    AppEventsService
} from "src/services";
import {
    followProgress,
    promptText,
    promptSelect,
    promptGroup,
    PromptGroupOptions,
    volumeParse,
    volumeFormat,
    injectVariables
} from "src/utils";


type PresetConfig = {
    image?: string;
    dockerfile?: string;
    buildArgsOptions?: PromptGroupOptions;
    envOptions?: PromptGroupOptions;
    volumes?: string[]
};

type BuildOptions = {
    rebuild?: boolean;
};

class PresetPlugin extends Plugin {
    public constructor(
        protected appConfigService: AppConfigService,
        protected appEventsService: AppEventsService
    ) {
        super("preset");

        this.pluginDir = Path.join(ROOT_DIR, "presets");
    }

    public install(cli: Cli) {
        super.install(cli);

        this.appConfigService.registerProjectType("preset", "Preset");

        this.appEventsService.on("project:init", (project: Project) => this.onInit(project));
        this.appEventsService.on("project:rebuild", (project: Project) => this.onRebuild(project));
        this.appEventsService.on("project:beforeStart", (project: Project) => this.onBeforeStart(project));

        cli.command("preset:build <preset>")
            .completion("preset", () => this.presets())
            .option("rebuild", {
                alias: "r",
                type: "boolean",
                description: "Rebuild image"
            })
            .action((options: BuildOptions, preset: string) => this.build(options, preset));
    }

    public async presets() {
        return FS.readdir(this.pluginPath());
    }

    protected async onInit(project: Project) {
        if(project.type !== "preset") {
            return;
        }

        const presetName = await promptSelect({
            message: "Select preset",
            options: await FS.readdir(PRESETS_DIR),
            default: project.getEnv("PRESET_NAME")
        });

        const preset = await Preset.get(presetName);

        project.setEnv("PRESET_NAME", presetName);

        if(preset.buildArgsOptions) {
            project.buildArgs = await promptGroup(project.buildArgs || {}, preset.buildArgsOptions);
        }

        if(preset.envOptions) {
            project.env = await promptGroup(project.env || {}, preset.envOptions);
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

        const presetName = project.getEnv("PRESET_NAME");
        const preset = await Preset.get(presetName);

        if(!preset) {
            throw new Error(`Preset ${presetName} not found`);
        }

        const imageName = preset.getImageName(project.buildArgs || {});
        const exists = await Docker.imageExists(imageName);

        if(exists) {
            console.info(`Removing image: ${imageName}`);

            await Docker.imageRm(imageName);
        }
    }

    protected async onBeforeStart(project: Project) {
        if(project.type !== "preset") {
            return;
        }

        const presetName = project.getEnv("PRESET_NAME");
        const preset = await Preset.get(presetName);

        const config: PresetConfig = await FS.readJSON(this.pluginPath(project.getEnv("PRESET_NAME"), "config.json"));

        // if(preset.volumes) {
        //     project.volumeMount(...preset.volumes);
        // }

        // if(preset.image) {
        //     project.imageName = config.image;
        //
        //     return;
        // }

        if(preset.dockerfile) {
            project.imageName = preset.getImageName(project.buildArgs);

            Logger.info(project.imageName);

            if(!await Docker.imageExists(project.imageName)) {
                const stream = await Docker.imageBuild2({
                    tag: project.imageName,
                    context: this.pluginPath(presetName),
                    src: config.dockerfile,
                    labels: {
                        presetName
                    },
                    buildArgs: project.buildArgs
                });

                await followProgress(stream);
            }
        }
    }

    public async build(options: BuildOptions, presetName: string) {
        const {
            rebuild
        } = options;

        const preset = await Preset.get(presetName);

        const presetPath = this.pluginPath(presetName);

        let buildArgs = {};

        if(preset.buildArgsOptions) {
            buildArgs = await promptGroup(buildArgs, preset.buildArgsOptions);
        }

        const imageName = preset.getImageName(buildArgs);

        Logger.info("Image name:", imageName);
        Logger.info("Build args:", buildArgs);

        if(rebuild) {
            const exists = await Docker.imageExists(imageName);

            if(exists) {
                await Docker.imageRm(imageName);
            }
        }

        const stream = await Docker.imageBuild2({
            tag: imageName,
            context: presetPath,
            src: preset.dockerfile,
            labels: {
                presetName,
                ...buildArgs
            },
            buildArgs
        });

        await followProgress(stream);
    }
}


export {PresetPlugin};
