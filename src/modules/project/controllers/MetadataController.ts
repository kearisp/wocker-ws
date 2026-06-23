import {
    AppService,
    Controller,
    Description,
    Command,
    Param,
    Option,
    EnvConfig
} from "@wocker/core";
import CliTable from "cli-table3";
import {ProjectService} from "../services/ProjectService";


@Controller()
@Description("Metadata commands")
export class MetadataController {
    public constructor(
        protected readonly appService: AppService,
        protected readonly projectService: ProjectService
    ) {}

    @Command("meta")
    @Description("List of metafields")
    public list(
        @Option("name", "n")
        @Description("The name of the project")
        projectName?: string,
        @Option("global", "g")
        global?: boolean
    ) {
        if(global) {
            const table = new CliTable();

            for(const key in this.appService.config.meta) {
                table.push([key, this.appService.config.meta[key]]);
            }

            return table.toString();
        }

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
        projectName?: string,
        @Option("global", "g")
        global?: boolean
    ) {
        const fields: EnvConfig = meta.reduce((res, field) => {
            let [, key = "", value = ""] = field.split(/^([^=]+)=(.*)$/);

            key = key.trim();
            value = value.trim();

            if(!key) {
                return res;
            }

            return {
                ...res,
                [key]: value
            };
        }, {});

        if(global) {
            for(const key in fields) {
                this.appService.config.setMeta(key, fields[key]);
            }

            this.appService.save();

            return;
        }

        const project = this.projectService.get(projectName);

        for(const key in fields) {
            project.setMeta(key, fields[key]);
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
