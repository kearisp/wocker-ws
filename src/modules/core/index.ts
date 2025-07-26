import {
    Global,
    Module,
    AppService,
    AppConfigService,
    AppFileSystemService,
    EventService,
    LogService,
    ProcessService,
    WOCKER_VERSION_KEY,
    WOCKER_DATA_DIR_KEY
} from "@wocker/core";
import {WOCKER_DATA_DIR, WOCKER_VERSION} from "../../env";
import {CompletionController} from "./controllers/CompletionController";
import {DebugController} from "./controllers/DebugController";
import {ExperimentalController} from "./controllers/ExperimentalController";


@Global()
@Module({
    controllers: [
        CompletionController,
        DebugController,
        ExperimentalController
    ],
    providers: [
        {
            provide: WOCKER_VERSION_KEY,
            useValue: WOCKER_VERSION
        },
        {
            provide: WOCKER_DATA_DIR_KEY,
            useValue: WOCKER_DATA_DIR
        },
        AppService,
        AppConfigService,
        AppFileSystemService,
        EventService,
        LogService,
        ProcessService
    ],
    exports: [
        AppService,
        AppConfigService,
        AppFileSystemService,
        EventService,
        LogService,
        ProcessService,
        WOCKER_VERSION_KEY,
        WOCKER_DATA_DIR_KEY
    ]
})
export class CoreModule {}
