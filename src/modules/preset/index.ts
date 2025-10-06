import {Module} from "@wocker/core";
import {DockerModule} from "../docker";
import {PresetController} from "./controllers/PresetController";
import {PresetListener} from "./controllers/PresetListener";
import {PresetRepository} from "./repositories/PresetRepository";
import {PresetService} from "./services/PresetService";


@Module({
    imports: [
        DockerModule
    ],
    controllers: [
        PresetController,
        PresetListener
    ],
    providers: [
        PresetRepository,
        PresetService
    ],
    exports: [
        PresetRepository,
        PresetService
    ]
})
export class PresetModule {}

export {
    PresetRepository,
    PresetService
};
