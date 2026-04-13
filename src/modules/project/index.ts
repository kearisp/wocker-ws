import {Module} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import {KeystoreModule} from "../keystore";
import {PresetModule} from "../preset";
import {ProjectController} from "./controllers/ProjectController";
import {SecretsController} from "./controllers/SecretsController";
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
        ProjectService
    ],
    exports: [
        ProjectService
    ]
})
export class ProjectModule {}
export {
    ProjectService
};
