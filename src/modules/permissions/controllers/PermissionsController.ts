import {
    Controller,
    Command,
    Description,
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
        path?: string
    ): Promise<string | void> {
        const {config} = this.appService;

        if(!path) {
            return this.formatList(config.permissions?.mounts?.allow, "No allowed mount paths");
        }

        const resolved = this.resolvePath(path);

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
        path?: string
    ): Promise<string | void> {
        const {config} = this.appService;

        if(!path) {
            return this.formatList(config.permissions?.mounts?.deny, "No denied mount paths");
        }

        config.addMountDeny(this.resolvePath(path));

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
