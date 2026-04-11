import {
    Module,
    DynamicModule,
    AppService
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import {CoreModule} from "../core";
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
            inject: [AppService],
            useFactory: (appService: AppService) => {
                if(!appService.isExperimentalEnabled("dns")) {
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
