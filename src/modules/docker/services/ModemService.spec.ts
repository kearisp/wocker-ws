import {describe, beforeEach, it, expect} from "@jest/globals";
import Modem from "docker-modem";
import {
    ApplicationContext,
    AppConfigService,
    AppService,
    AppFileSystemService,
    LogService,
    ProcessService
} from "@wocker/core";
import {Test} from "@wocker/testing";
import {CoreModule} from "../../core";
import {ModemService} from "./ModemService";
import {DockerService} from "./DockerService";
import {ProtoService} from "./ProtoService";
import {ContainerService} from "./ContainerService";


describe("ModemService", (): void => {
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test.createTestingModule({
            imports: [
                CoreModule
            ],
            providers: [
                AppService,
                AppConfigService,
                AppFileSystemService,
                ModemService,
                ProtoService,
                DockerService,
                ContainerService,
                ProcessService,
                LogService
            ]
        }).build();
    });

    it("should...", async (): Promise<void> => {
        const modemService = context.get(ModemService);

        expect(modemService.modem).toBeInstanceOf(Modem);
    });
});
