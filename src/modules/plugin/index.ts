import {
    Module,
    Type,
    DynamicModule,
    AppService,
    AppFileSystemService,
    LogService,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import {CoreModule} from "../core";
import {PackageManagerModule} from "../package-manager";
import {PluginController} from "./controllers/PluginController";
import {PluginService} from "./services/PluginService";


@Module({
    imports: [
        CoreModule,
        PackageManagerModule
    ],
    controllers: [PluginController],
    providers: [PluginService]
})
export class PluginModule {
    public static register(): DynamicModule {
        return {
            module: PluginModule,
            inject: [
                AppService,
                AppFileSystemService,
                LogService,
                PluginService
            ],
            useFactory: async (
                appService: AppService,
                fs: AppFileSystemService,
                logService: LogService,
                pluginService: PluginService
            ) => {
                const imports: (Type | DynamicModule)[] = [];

                for(const pluginData of appService.plugins) {
                    try {
                        const plugin = await pluginService.import(pluginData.name);

                        imports.push({
                            module: plugin.type,
                            providers: [
                                {
                                    provide: PLUGIN_DIR_KEY,
                                    useValue: fs.path("plugins", plugin.name)
                                }
                            ]
                        });
                    }
                    catch(err) {
                        logService.error(err.message, {
                            pluginName: pluginData.name,
                            pluginEnv: pluginData.env
                        });

                        appService.removePlugin(pluginData.name);
                    }
                }

                return {
                    imports
                };
            }
        };
    }
}
