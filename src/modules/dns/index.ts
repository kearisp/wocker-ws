import {
    Module,
    DynamicModule,
    AppConfigService
} from "@wocker/core";
import {CoreModule} from "../core";
import {DockerModule} from "../docker";
import {DnsController} from "./controllers/DnsController";
import {DnsService} from "./services/DnsService";


@Module({
    imports: [
        CoreModule
    ]
})
export class DnsModule {
    public static register(): DynamicModule {
        return {
            module: DnsModule,
            inject: [AppConfigService],
            useFactory: (appConfigService: AppConfigService) => {
                if(!appConfigService.isExperimentalEnabled("dns")) {
                    return {};
                }

                return {
                    imports: [DockerModule],
                    controllers: [DnsController],
                    providers: [DnsService]
                };
            }
        };
    }
}
