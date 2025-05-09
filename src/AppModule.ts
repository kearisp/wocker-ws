import {
    Module,
    Global,
    Container,
    MODULE_METADATA,
    PLUGIN_DIR_KEY
} from "@wocker/core";

import {
    CertController,
    CompletionController,
    DebugController,
    KeystoreController,
    PluginController,
    PresetController,
    ProjectController,
    ProxyController
} from "./controllers";
import {
    PresetRepository
} from "./repositories";
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
import {KeystoreService} from "./keystore";


@Global()
@Module({
    controllers: [
        CompletionController,
        DebugController,
        KeystoreController,
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
        CertService,
        KeystoreService,
        PresetRepository
    ],
    exports: [
        AppConfigService,
        AppEventsService,
        DockerService,
        LogService,
        ProjectService,
        ProxyService,
        KeystoreService
    ]
})
export class AppModule {
    public async load(container: Container) {
        const appConfigService = container.getModule(AppModule).get<AppConfigService>(AppConfigService);
        const logService = container.getModule(AppModule).get<LogService>(LogService);
        const pluginService = container.getModule(AppModule).get<PluginService>(PluginService);

        const imports: any[] = [];

        for(const pluginData of appConfigService.config.plugins || []) {
            try {
                const plugin = await pluginService.import(pluginData.name);

                Reflect.defineMetadata(MODULE_METADATA.PROVIDERS, [
                    ...Reflect.getMetadata(MODULE_METADATA.PROVIDERS, plugin.type) || [],
                    {
                        provide: PLUGIN_DIR_KEY,
                        useValue: appConfigService.dataPath("plugins", plugin.name)
                    }
                ], plugin.type);

                imports.push(plugin.type);
            }
            catch(err) {
                logService.error(err.message);

                appConfigService.config.removePlugin(pluginData.name);
                appConfigService.save();

                throw err;
            }
        }

        return {
            imports
        };
    }
}
