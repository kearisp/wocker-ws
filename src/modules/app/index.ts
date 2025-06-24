import {Module, WOCKER_DATA_DIR_KEY, WOCKER_VERSION_KEY} from "@wocker/core";
import {WOCKER_DATA_DIR, WOCKER_VERSION} from "../../env";


@Module({
    providers: [
        {
            provide: WOCKER_VERSION_KEY,
            useValue: WOCKER_VERSION
        },
        {
            provide: WOCKER_DATA_DIR_KEY,
            useValue: WOCKER_DATA_DIR
        }
    ],
    exports: [
        WOCKER_VERSION_KEY,
        WOCKER_DATA_DIR_KEY
    ]
})
export class AppModule {}
