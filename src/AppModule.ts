import {
    Module,
    Global,
    Container,
    MODULE_METADATA,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import {
    CompletionController,
    DebugController,
    ExperimentalController,
    PluginController,
    PresetController,
    ProjectController
} from "./controllers";
import {PresetRepository} from "./repositories";
import {AppConfigService} from "./services/AppConfigService";
import {AppEventsService} from "./services/AppEventsService";
import {PluginService} from "./services/PluginService";
import {PresetService} from "./services/PresetService";
import {ProjectService} from "./services/ProjectService";
import {NpmService} from "./services/NpmService";
import {LogService} from "./services/LogService";
import {
    DockerModule,
    DockerService,
    ContainerService,
    ProxyModule,
    ProxyService,
    KeystoreModule,
    KeystoreService,
    CertService
} from "./modules";


@Global()
@Module({
    imports: [
        DockerModule,
        KeystoreModule,
        ProxyModule
    ],
    controllers: [
        CompletionController,
        ProjectController,
        PresetController,
        PluginController,
        ExperimentalController,
        DebugController
    ],
    providers: [
        AppConfigService,
        AppEventsService,
        LogService,
        NpmService,
        ProjectService,
        PluginService,
        PresetService,
        PresetRepository
    ],
    exports: [
        AppConfigService,
        AppEventsService,
        LogService,
        DockerService,
        CertService,
        ContainerService,
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
