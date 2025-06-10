import {
    Controller,
    Command,
    Param,
    Project,
    Option,
    Description,
    PRESET_SOURCE_EXTERNAL,
    AppConfigService
} from "@wocker/core";
import CliTable from "cli-table3";
import {promptConfirm} from "@wocker/utils";
import {DockerService} from "../../docker";
import {PresetRepository} from "../repositories/PresetRepository";
import {PresetService} from "../services/PresetService";


@Controller()
@Description("Preset commands")
export class PresetController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly presetRepository: PresetRepository,
        protected readonly presetService: PresetService,
        // protected readonly projectService: ProjectService
    ) {}

    @Command("preset:init")
    @Description("Creates preset config for current dir")
    public async init(): Promise<void> {
        await this.presetService.init();
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

    @Command("preset:destroy")
    public async destroy(): Promise<void> {
        await this.presetService.deinit();
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
            context: preset.path,
            src: preset.dockerfile
        });
    }

    public async presets(): Promise<string[]> {
        const presets = this.presetRepository.search();

        return presets.map((preset) => {
            return preset.name;
        });
    }
}
