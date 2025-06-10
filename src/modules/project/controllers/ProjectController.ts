import {
    Controller,
    Command,
    Description,
    Option,
    AppConfigService,
    FileSystemManager,
    ProcessService
} from "@wocker/core";
import {promptConfirm} from "@wocker/utils";
import Path from "path";
import {PresetService} from "../../preset";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Project commands")
export class ProjectController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly processService: ProcessService,
        protected readonly projectService: ProjectService,
        protected readonly presetService: PresetService
    ) {}

    @Command("start")
    @Description("Starting project")
    public async start(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string,
        @Option("restart", "r")
        @Description("Restarting project")
        restart?: boolean,
        @Option("build", "b")
        @Description("Build")
        build?: boolean,
        @Option("attach", "a")
        @Description("Attach")
        attach?: boolean
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.start(project, restart, build, attach);
    }

    @Command("stop")
    @Description("Stopping project")
    public async stop(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);

        await this.projectService.stop(project);
    }

    @Command("preset:eject")
    @Description("Eject preset files into the project")
    public async eject(
        @Option("name", "n")
        @Description("The name of the project")
        name?: string
    ): Promise<void> {
        const project = this.projectService.get(name);
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
            preset.path,
            this.processService.pwd()
        );

        if(preset.dockerfile) {
            if(!copier.destination.exists(preset.dockerfile)) {
                copier.copy(preset.dockerfile);
            }

            project.type = "dockerfile";
            project.dockerfile = preset.dockerfile;
        }

        const files = copier.source.readdir("", {
            recursive: true
        });

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
}
