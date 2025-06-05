import {Module} from "@wocker/core";
import {KeystoreController} from "./controllers/KeystoreController";
import {KeystoreService} from "./services/KeystoreService";


@Module({
    controllers: [
        KeystoreController
    ],
    providers: [
        KeystoreService
    ],
    exports: [
        KeystoreService
    ]
})
export class KeystoreModule {}
export {KeystoreService};
