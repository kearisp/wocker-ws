import {
    Controller,
    Description,
    Command,
    Param,
    Option
} from "@wocker/core";
import CliTable from "cli-table3";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Metadata commands")
export class MetadataController {
    public constructor(
        protected readonly projectService: ProjectService
    ) {}

    @Command("meta")
    @Description("List of metafields")
    public list(
        @Option("name", "n")
        @Description("The name of the project")
        projectName?: string
    ) {
        const project = this.projectService.get(projectName);

        const table = new CliTable();

        for(const key in project.metadata) {
            table.push([key, project.metadata[key]]);
        }

        return table.toString();
    }

    @Command("meta:set [...meta]")
    public set(
        @Param("meta")
        meta: string[],
        @Option("name", "n")
        @Description("The name of the project")
        projectName?: string
    ) {
        const project = this.projectService.get(projectName);

        for(const field of meta) {
            let [, key = "", value = ""] = field.split(/^([^=]+)=(.*)$/);

            key = key.trim();
            value = value.trim();

            if(!key) {
                continue;
            }

            project.setMeta(key, value);
        }

        project.save();
    }

    @Command("meta:unset [...meta]")
    public unset(
        @Param("meta")
        meta: string[],
        @Option("name", "n")
        @Description("The name of the project")
        projectName?: string
    ) {
        const project = this.projectService.get(projectName);

        for(const field of meta) {
            let [, key = ""] = field.split(/^([^=]+)(?:=(.*))?$/);

            key = key.trim();

            project.unsetMeta(key);
        }

        project.save();
    }
}
