import {Module} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import {ProjectModule} from "../project";
import {HttpAuthController} from "./controllers/HttpAuthController";
import {CertController} from "./controllers/CertController";
import {ProxyController} from "./controllers/ProxyController";
import {HttpAuthService} from "./services/HttpAuthService";
import {CertService} from "./services/CertService";
import {ProxyService} from "./services/ProxyService";


@Module({
    imports: [
        DockerModule,
        ProjectModule
    ],
    controllers: [
        HttpAuthController,
        CertController,
        ProxyController
    ],
    providers: [
        HttpAuthService,
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
