import {Module} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import {KeystoreModule} from "../keystore";
import {PresetModule} from "../preset";
import {ProjectController} from "./controllers/ProjectController";
import {SecretsController} from "./controllers/SecretsController";
import {ProjectRepository} from "./repositories/ProjectRepository";
import {ProjectService} from "./services/ProjectService";


@Module({
    imports: [
        DockerModule,
        KeystoreModule,
        PresetModule
    ],
    controllers: [
        ProjectController,
        SecretsController
    ],
    providers: [
        ProjectRepository,
        ProjectService
    ],
    exports: [
        ProjectRepository,
        ProjectService
    ]
})
export class ProjectModule {}
export {
    ProjectRepository,
    ProjectService
};
