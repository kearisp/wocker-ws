import {
    AppConfigService,
    ProcessService,
    AppFileSystemService,
    LogService,
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
    ProjectController
} from "./controllers";
import {PluginService} from "./services/PluginService";
import {NpmService} from "./services/NpmService";
import {
    CoreModule,
    ProjectModule, ProjectService,
    DockerModule, DockerService, ContainerService, ImageService,
    PresetModule, PresetRepository, PresetService,
    ProxyModule, ProxyService, CertService,
    KeystoreModule, KeystoreService
} from "./modules";


@Global()
@Module({
    imports: [
        CoreModule,
        ProjectModule,
        PresetModule,
        DockerModule,
        KeystoreModule,
        ProxyModule
    ],
    controllers: [
        CompletionController,
        ProjectController,
        PluginController,
        ExperimentalController,
        DebugController
    ],
    providers: [
        NpmService,
        PluginService
    ],
    exports: [
        DockerService,
        CertService,
        ContainerService,
        ImageService,
        ProxyService,
        KeystoreService,
        PresetRepository,
        PresetService,
        ProjectService,
        ProcessService
    ]
})
export class AppModule {
    // noinspection JSUnusedGlobalSymbols
    public async load(container: Container) {
        const appModule = container.getModule(AppModule),
              fs = appModule.get<AppFileSystemService>(AppFileSystemService),
              appConfigService = appModule.get<AppConfigService>(AppConfigService),
              logService = appModule.get<LogService>(LogService),
              pluginService = appModule.get<PluginService>(PluginService);

        const imports: any[] = [];

        for(const pluginData of appConfigService.plugins || []) {
            try {
                const plugin = await pluginService.import(pluginData.name);

                Reflect.defineMetadata(MODULE_METADATA.PROVIDERS, [
                    ...Reflect.getMetadata(MODULE_METADATA.PROVIDERS, plugin.type) || [],
                    {
                        provide: PLUGIN_DIR_KEY,
                        useValue: fs.path("plugins", plugin.name)
                    }
                ], plugin.type);

                imports.push(plugin.type);
            }
            catch(err) {
                logService.error(err.message);

                appConfigService.removePlugin(pluginData.name);
                appConfigService.save();

                throw err;
            }
        }

        return {
            imports
        };
    }
}
