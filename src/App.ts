import {
    DI,
    AppConfigService as CoreAppConfigService,
    AppEventsService as CoreAppEventsService,
    DockerService as CoreDockerService,
    LogService as CoreLogService,
    PresetService as CorePresetService,
    ProjectService as CoreProjectService,
    Preset,
    Project,
    Logger,
    Controller
} from "@wocker/core";
import {Cli} from "@kearisp/cli";
import * as Path from "path";

import {DATA_DIR, MAP_PATH} from "./env";
import {setConfig} from "./utils";
import {FS} from "./makes";
import {
    AppConfigService,
    AppEventsService,
    DockerService,
    LogService,
    PresetService,
    PluginService,
    ProjectService
} from "./services";
import {
    ImageController,
    PluginController,
    PresetController,
    ProjectController,
    ProxyController
} from "./controllers";


export class App {
    protected di: DI;
    protected cli: Cli;
    protected appConfigService: AppConfigService;

    public constructor() {
        this.di = new DI();

        this.appConfigService = new AppConfigService();

        this.di.registerService(CoreAppConfigService, this.appConfigService);
        this.di.registerService(CoreAppEventsService, new AppEventsService());
        this.di.registerService(CoreDockerService, new DockerService(this.di));
        this.di.registerService(CorePresetService, new PresetService(this.di));
        this.di.registerService(PluginService, new PluginService(this.di));
        this.di.registerService(CoreProjectService, new ProjectService(this.di));
        this.di.registerService(CoreLogService, new LogService(this.di));

        this.di.registerService(Cli, this.cli);
        this.cli = new Cli(Logger);

        Preset.install(this.di);
        Project.install(this.di);
        Logger.install(this.di);

        this.install();

        this.use(ImageController);
        this.use(PluginController);
        this.use(PresetController);
        this.use(ProjectController);
        this.use(ProxyController);
    }

    public install() {
        this.cli.command("completion script")
            .help(false)
            .action(() => this.cli.completionScript());

        this.cli.command("log [...items]")
            .action((options, items) => {
                Logger.log(...items as string[]);

                return "";
            });

        this.cli.command("debug <status>")
            .completion("status", () => ["on", "off"])
            .action(async (options, status: string) => this.setDebug(status));
    }

    public use(Constructor: {new (...params: any[]): Controller}): void {
        const controller = new Constructor(this.di);

        controller.install(this.cli);
    }

    public async setDebug(status: string) {
        Logger.info(`Set debug ${status}`);

        await setConfig({
            debug: status === "on"
        });

        return "";
    }

    public async run(): Promise<string> {
        const mapDir = Path.dirname(MAP_PATH);

        if(!FS.existsSync(mapDir)) {
            await FS.mkdir(mapDir);
        }

        if(!FS.existsSync(MAP_PATH)) {
            await FS.writeJSON(MAP_PATH, {
                projects: []
            });
        }

        if(!FS.existsSync(`${DATA_DIR}/projects`)) {
            await FS.mkdir(`${DATA_DIR}/projects`);
        }

        const {
            plugins = []
        } = await this.appConfigService.getAppConfig();

        for(const plugin of plugins) {
            try {
                const {default: Plugin} = await import(plugin);

                this.use(Plugin);
            }
            catch(err) {
                Logger.error(err.message);
            }
        }

        return this.cli.run(process.argv);
    }
}
