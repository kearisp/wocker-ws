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
    ProjectModule, ProjectService, ProjectRepository,
    PluginModule,
    PresetModule, PresetRepository, PresetService,
    ProxyModule, ProxyService, CertService,
    KeystoreModule, KeystoreService
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
        ProxyModule
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
        ProcessService,
        ProjectRepository
    ]
})
export class AppModule {}
