import {Module} from "@wocker/core";
import {ContainerService} from "./services/ContainerService";
import {ImageService} from "./services/ImageService";
import {DockerService} from "./services/DockerService";
import {ModemService} from "./services/ModemService";
import {ProtoService} from "./services/ProtoService";


@Module({
    providers: [
        ContainerService,
        ImageService,
        DockerService,
        ModemService,
        ProtoService
    ],
    exports: [
        ContainerService,
        ImageService,
        DockerService,
        ModemService,
        ProtoService
    ]
})
export class DockerModule {}
export {
    ContainerService,
    ImageService,
    DockerService,
    ModemService,
    ProtoService
};
