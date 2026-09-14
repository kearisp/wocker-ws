import {
    Controller,
    Command,
    Description,
    Option,
    Param,
    AppService,
    isSensitivePath
} from "@wocker/core";
import {promptInput} from "@wocker/prompts";
import OS from "os";
import Path from "path";
import CliTable from "cli-table3";


@Controller()
@Description("Mount permission commands")
export class PermissionsController {
    public constructor(
        protected readonly appService: AppService
    ) {}

    @Command("mount:allow [path]")
    @Description("Allow a host path to be used as a mount source")
    public async mountAllow(
        @Param("path")
        path?: string,
        @Option("remove", {
            type: "boolean",
            alias: "r",
            description: "Remove the path from the allow list"
        })
        remove?: boolean
    ): Promise<string | void> {
        const {config} = this.appService;

        if(!path) {
            if(remove) {
                throw new Error("Path is required to remove a mount permission");
            }

            return this.formatList(config.permissions?.mounts?.allow, "No allowed mount paths");
        }

        const resolved = this.resolvePath(path);

        if(remove) {
            config.removeMountAllow(resolved);

            this.appService.save();

            return;
        }

        if(isSensitivePath(resolved)) {
            const confirmation = await promptInput({
                required: true,
                type: "text",
                message: [
                    "",
                    "You are granting mount access to a sensitive path:",
                    `  ${resolved}`,
                    "",
                    "Type the path again to confirm"
                ].join("\n"),
                validate: (value: string) => value === resolved || `Input doesn't match "${resolved}"`
            });

            if(confirmation !== resolved) {
                throw new Error(`Confirmation doesn't match "${resolved}", aborting`);
            }
        }

        config.addMountAllow(resolved);

        this.appService.save();
    }

    @Command("mount:deny [path]")
    @Description("Deny a host path from being used as a mount source")
    public async mountDeny(
        @Param("path")
        path?: string,
        @Option("remove", {
            type: "boolean",
            alias: "r",
            description: "Remove the path from the deny list"
        })
        remove?: boolean
    ): Promise<string | void> {
        const {config} = this.appService;

        if(!path) {
            if(remove) {
                throw new Error("Path is required to remove a mount permission");
            }

            return this.formatList(config.permissions?.mounts?.deny, "No denied mount paths");
        }

        const resolved = this.resolvePath(path);

        if(remove) {
            config.removeMountDeny(resolved);

            this.appService.save();

            return;
        }

        config.addMountDeny(resolved);

        this.appService.save();
    }

    protected resolvePath(path: string): string {
        if(path.startsWith("~")) {
            return Path.join(OS.homedir(), path.slice(1));
        }

        return Path.resolve(path);
    }

    protected formatList(paths: string[] | undefined, emptyMessage: string): string {
        if(!paths || paths.length === 0) {
            return emptyMessage;
        }

        const table = new CliTable({
            head: ["Path"]
        });

        for(const path of paths) {
            table.push([path]);
        }

        return table.toString();
    }
}
