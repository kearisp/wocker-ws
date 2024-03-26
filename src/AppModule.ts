import {
    Module,
    Container,
    MODULE_METADATA,
    PLUGIN_DIR_KEY
} from "@wocker/core";

import {
    CompletionController,
    ImageController,
    PluginController,
    PresetController,
    ProjectController,
    ProxyController
} from "./controllers";
import {
    AppConfigService,
    AppEventsService,
    DockerService,
    LogService,
    PluginService,
    PresetService,
    ProjectService
} from "./services";


@Module({
    controllers: [
        CompletionController,
        ImageController,
        PluginController,
        PresetController,
        ProjectController,
        ProxyController
    ],
    providers: [
        AppConfigService,
        AppEventsService,
        DockerService,
        LogService,
        PluginService,
        PresetService,
        ProjectService
    ],
    exports: [
        AppConfigService,
        AppEventsService,
        DockerService,
        LogService
    ]
})
export class AppModule {
    public async load(container: Container) {
        const appConfigService = container.getModule(AppModule).get<AppConfigService>(AppConfigService);
        const logService = container.getModule(AppModule).get<LogService>(LogService);
        const config = await appConfigService.getAppConfig();
        const {plugins} = config;

        const imports: any[] = [];

        for(const plugin of plugins) {
            try {
                const {default: Plugin} = await import(plugin);

                if(!Plugin) {
                    continue;
                }

                const name = Reflect.getMetadata(MODULE_METADATA.NAME, Plugin);

                Reflect.defineMetadata(MODULE_METADATA.PROVIDERS, [
                    ...Reflect.getMetadata(MODULE_METADATA.PROVIDERS, Plugin) || [],
                    {
                        provide: PLUGIN_DIR_KEY,
                        useValue: name ? appConfigService.dataPath("plugins", name) : undefined
                    }
                ], Plugin);

                imports.push(Plugin);
            }
            catch(err) {
                logService.error(err.message);

                throw err;
            }
        }

        return {
            imports
        };
    }
}
