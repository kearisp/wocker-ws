import {Module} from "@wocker/core";
import {ContainerService} from "./services/ContainerService";
import {DockerService} from "./services/DockerService";
import {ImageService} from "./services/ImageService";
import {ModemService} from "./services/ModemService";
import {ProtoService} from "./services/ProtoService";


@Module({
    providers: [
        ContainerService,
        DockerService,
        ImageService,
        ModemService,
        ProtoService
    ],
    exports: [
        ContainerService,
        DockerService,
        ImageService,
        ModemService,
        ProtoService
    ]
})
export class DockerModule {}
export {
    ContainerService,
    DockerService,
    ImageService,
    ModemService,
    ProtoService
};
