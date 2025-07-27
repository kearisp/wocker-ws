import {Module} from "@wocker/core";
import {ComposeService} from "./services/ComposeService";
import {ContainerService} from "./services/ContainerService";
import {DockerService} from "./services/DockerService";
import {ImageService} from "./services/ImageService";
import {ModemService} from "./services/ModemService";
import {ProtoService} from "./services/ProtoService";


@Module({
    providers: [
        ComposeService,
        ContainerService,
        DockerService,
        ImageService,
        ModemService,
        ProtoService
    ],
    exports: [
        ComposeService,
        ContainerService,
        DockerService,
        ImageService,
        ModemService,
        ProtoService
    ]
})
export class DockerModule {}

export {
    ComposeService,
    ContainerService,
    DockerService,
    ImageService,
    ModemService,
    ProtoService
};
