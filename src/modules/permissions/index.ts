import {Module} from "@wocker/core";
import {PermissionsController} from "./controllers/PermissionsController";


@Module({
    controllers: [
        PermissionsController
    ]
})
export class PermissionsModule {}
