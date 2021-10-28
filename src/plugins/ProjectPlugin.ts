import CliTable from "cli-table3";
import {Cli} from "@kearisp/cli";

import {Plugin, Docker} from "src/makes";
import {Project} from "src/models";


type ProjectListOptions = {
    all?: boolean;
};

class ProjectPlugin extends Plugin {
    public constructor() {
        super("project");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("ps")
            .option("all", {
                type: "boolean",
                alias: "a",
                description: "All projects"
            })
            .action((options: ProjectListOptions) => this.projectList(options));
    }

    public async projectList(options: ProjectListOptions) {
        const {all} = options;

        const projects = await Project.search();

        const table = new CliTable({
            head: ["Name", "Type", "Status"],
            colAligns: ["left", "center"]
        });

        for(const i in projects) {
            const project = projects[i];
            const container = await Docker.getContainer(`${project.name}.workspace`);

            if(!container) {
                if(all) {
                    table.push([project.name, project.type, "-"]);
                }

                continue;
            }

            const {
                State: {
                    Status = "Stopped"
                } = {}
            } = await container.inspect();

            table.push([project.name, project.type, Status]);
        }

        return table.toString();
    }

    public async init() {
        //
    }
}


export {ProjectPlugin};
