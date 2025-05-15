import {Module} from "@wocker/core";
import {ContainerService} from "./services/ContainerService";
import {ImageService} from "./services/ImageService";
import {DockerService} from "./services/DockerService";
import {ModemService} from "./services/ModemService";


@Module({
    providers: [
        ContainerService,
        ImageService,
        DockerService,
        ModemService
    ],
    exports: [
        ContainerService,
        ImageService,
        DockerService,
        ModemService
    ]
})
export class DockerModule {}
export {
    ContainerService,
    ImageService,
    DockerService,
    ModemService
};
