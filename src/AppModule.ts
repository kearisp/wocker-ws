import {
    ProcessService,
    Module,
    Global
} from "@wocker/core";
import DockerModule, {
    DockerService,
    ContainerService,
    ImageService
} from "@wocker/docker-module";
import {
    CoreModule,
    DnsModule,
    ProjectModule, ProjectService,
    PluginModule,
    PresetModule, PresetRepository, PresetService,
    ProxyModule, ProxyService, CertService,
    KeystoreModule, KeystoreService,
    PermissionsModule
} from "./modules";


@Global()
@Module({
    imports: [
        CoreModule,
        DnsModule.register(),
        PluginModule.register(),
        ProjectModule,
        PresetModule,
        DockerModule,
        KeystoreModule,
        ProxyModule,
        PermissionsModule
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
export class AppModule {}
