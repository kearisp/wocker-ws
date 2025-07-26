import {Module} from "@wocker/core";
import {NpmService} from "./services/NpmService";


@Module({
    providers: [NpmService],
    exports: [NpmService],
})
export class NpmModule {}

export {
    NpmService
};
