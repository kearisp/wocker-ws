import {Module} from "@wocker/core";
import {CoreModule} from "../core";
import {PackageManager} from "./service/PackageManager";
import {RegistryService} from "./service/RegistryService";


@Module({
    imports: [
        CoreModule
    ],
    providers: [
        PackageManager,
        RegistryService
    ],
    exports: [
        PackageManager,
        RegistryService
    ]
})
export class PackageManagerModule {}

export {
    PackageManager,
    RegistryService
};
