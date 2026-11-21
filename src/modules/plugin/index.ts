import {
    Module,
    Type,
    DynamicModule,
    AppService,
    AppFileSystemService,
    LogService,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import {SLOW_PLUGIN_IMPORT_MS} from "../../env";
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

                for(const pluginRef of appService.plugins) {
                    try {
                        const start = Date.now(),
                              plugin = await pluginService.import(pluginRef.name),
                              duration = Date.now() - start;

                        if(duration > SLOW_PLUGIN_IMPORT_MS) {
                            logService.warn(`Plugin ${pluginRef.name} took ${duration}ms to load`);
                        }

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
                            pluginName: pluginRef.name,
                            pluginEnv: pluginRef.env
                        });

                        appService.removePlugin(pluginRef.name);
                    }
                }

                return {
                    imports
                };
            }
        };
    }
}
