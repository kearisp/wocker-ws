import {
    Controller,
    Description,
    Command,
    Param,
    Option,
    Event,
    Project
} from "@wocker/core";
import {promptInput} from "@wocker/utils";
import {ProjectService} from "../../project";
import {HttpAuthService} from "../services/HttpAuthService";
import {ProxyService} from "../services/ProxyService";


@Controller()
@Description("BasicAuth commands")
export class HttpAuthController {
    public constructor(
        protected readonly projectService: ProjectService,
        protected readonly httpAuthService: HttpAuthService,
        protected readonly proxyService: ProxyService
    ) {}

    @Event("project:add-domain")
    public async onAddDomain(project: Project, ...domains: string[]) {
        console.log("New domains:", domains);
    }

    @Command("http-auth:enable")
    public async enable(
        @Option("domain", "d")
        @Description("Domain to apply authentication to.")
        domain?: string
    ) {
        await this.httpAuthService.enableForProject(
            this.projectService.get(),
            domain
        );

        await this.proxyService.start(true);
    }

    @Command("http-auth:disable")
    public async disable(
        @Option("domain", "d")
        domain?: string
    ) {
        await this.httpAuthService.disableForProject(
            this.projectService.get(),
            domain
        );

        await this.proxyService.start(true);
    }

    @Command("http-auth:add-user")
    @Command("http-auth:add-user [user]")
    @Command("http-auth:add-user [user]:[password]")
    @Description("Add a user for HTTP Basic Auth")
    public async add(
        @Param("user")
        @Description("Username for Basic Auth. If omitted, you will be prompted.")
        user?: string,
        @Param("password")
        @Description("Password for Basic Auth. If omitted, you will be prompted.")
        password?: string,
        @Option("global", "g")
        @Description("")
        global?: boolean,
        @Option("algorithm", "a")
        @Description("Password hashing algorithm (e.g. md5, bcrypt, sha1, sha256, sha512).")
        algorithm?: HttpAuthService.Algorithm
    ) {
        if(!user) {
            user = await promptInput({
                required: true,
                message: "User",
                type: "text"
            });
        }

        if(!password) {
            password = await promptInput({
                required: true,
                message: "Password",
                type: "password"
            });
        }

        if(global) {
            await this.httpAuthService.addForGlobal(user, password, algorithm);
        }
        else {
            await this.httpAuthService.addForProject(
                this.projectService.get(),
                user,
                password,
                algorithm
            );
        }

        await this.proxyService.start(true);
    }

    @Command("http-auth:remove [user]")
    public async remove(
        @Param("user")
        user?: string
    ) {
        await this.httpAuthService.removeForProject(
            this.projectService.get(),
            user
        );
    }

    @Command("http-auth:clear")
    public async clear() {
        //
    }
}
