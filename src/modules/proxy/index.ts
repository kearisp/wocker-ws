import {Module} from "@wocker/core";
import {DockerModule} from "../docker";
import {CertController} from "./controllers/CertController";
import {ProxyController} from "./controllers/ProxyController";
import {CertService} from "./services/CertService";
import {ProxyService} from "./services/ProxyService";


@Module({
    imports: [
        DockerModule
    ],
    controllers: [
        CertController,
        ProxyController
    ],
    providers: [
        ProxyService,
        CertService
    ],
    exports: [
        ProxyService,
        CertService
    ]
})
export class ProxyModule {}
export {
    ProxyService,
    CertService
};
