import {
    Global,
    Module
} from "@wocker/core";
import {CompletionController} from "./controllers/CompletionController";
import {DebugController} from "./controllers/DebugController";
import {ExperimentalController} from "./controllers/ExperimentalController";


@Global()
@Module({
    controllers: [
        CompletionController,
        DebugController,
        ExperimentalController
    ]
})
export class CoreModule {}
