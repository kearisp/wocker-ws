import {
    Module,
    Global,
    Container,
    MODULE_METADATA,
    PLUGIN_NAME_METADATA,
    PLUGIN_DIR_KEY
} from "@wocker/core";

import {
    CertController,
    CompletionController,
    DebugController,
    ImageController,
    PluginController,
    PresetController,
    ProjectController,
    ProxyController
} from "./controllers";
import {
    AppConfigService,
    AppEventsService,
    CertService,
    DockerService,
    LogService,
    NpmService,
    PluginService,
    PresetService,
    ProjectService,
    ProxyService
} from "./services";
import {
    ElasticSearchPlugin,
    ProxmoxPlugin
} from "./plugins";


@Global()
@Module({
    controllers: [
        CompletionController,
        DebugController,
        ImageController,
        PluginController,
        PresetController,
        ProjectController,
        ProxyController,
        CertController
    ],
    providers: [
        AppConfigService,
        AppEventsService,
        DockerService,
        LogService,
        NpmService,
        PluginService,
        PresetService,
        ProjectService,
        ProxyService,
        CertService
    ],
    exports: [
        AppConfigService,
        AppEventsService,
        DockerService,
        LogService,
        ProjectService,
        ProxyService
    ],
    imports: [
        ElasticSearchPlugin,
        // ProxmoxPlugin
    ]
})
export class AppModule {
    public async load(container: Container) {
        const appConfigService = container.getModule(AppModule).get<AppConfigService>(AppConfigService);
        const logService = container.getModule(AppModule).get<LogService>(LogService);
        // const pluginService = container.getModule(AppModule).get<PluginService>(PluginService);
        const config = appConfigService.getConfig();

        const imports: any[] = [];

        for(const plugin of config.plugins || []) {
            try {
                const {default: Plugin} = await import(plugin);

                if(!Plugin) {
                    continue;
                }

                const name = Reflect.getMetadata(PLUGIN_NAME_METADATA, Plugin);

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

                config.removePlugin(plugin);

                await config.save();

                throw err;
            }
        }

        return {
            imports
        };
    }
}
