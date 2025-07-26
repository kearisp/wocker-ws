import {
    Module,
    Type,
    DynamicModule,
    AppConfigService,
    AppFileSystemService,
    LogService,
    PLUGIN_DIR_KEY
} from "@wocker/core";
import {CoreModule} from "../core";
import {NpmModule} from "../npm";
import {PluginController} from "./controllers/PluginController";
import {PluginService} from "./services/PluginService";


@Module({
    imports: [
        CoreModule,
        NpmModule
    ],
    controllers: [PluginController],
    providers: [PluginService]
})
export class PluginModule {
    public static register(): DynamicModule {
        return {
            module: PluginModule,
            inject: [
                AppConfigService,
                AppFileSystemService,
                LogService,
                PluginService
            ],
            useFactory: async (
                appConfigService: AppConfigService,
                fs: AppFileSystemService,
                logService: LogService,
                pluginService: PluginService
            ) => {
                const imports: (Type | DynamicModule)[] = [];

                for(const pluginData of appConfigService.plugins) {
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
        };
    }
}
