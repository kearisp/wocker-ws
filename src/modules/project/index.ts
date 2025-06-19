import {Module} from "@wocker/core";
import {KeystoreModule} from "../keystore";
import {DockerModule} from "../docker";
import {PresetModule} from "../preset";
import {ProjectController} from "./controllers/ProjectController";
import {ProjectRepository} from "./repositories/ProjectRepository";
import {ProjectService} from "./services/ProjectService";


@Module({
    imports: [
        PresetModule,
        KeystoreModule,
        DockerModule
    ],
    controllers: [ProjectController],
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
