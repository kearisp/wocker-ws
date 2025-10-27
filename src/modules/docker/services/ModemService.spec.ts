import {describe, beforeEach, it, expect} from "@jest/globals";
import Modem from "docker-modem";
import {ApplicationContext} from "@wocker/core";
import {Test} from "@wocker/testing";
import {ModemService} from "./ModemService";
import {DockerService} from "./DockerService";
import {ProtoService} from "./ProtoService";
import {ContainerService} from "./ContainerService";


describe("ModemService", (): void => {
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test.createTestingModule({
            providers: [
                ModemService,
                ProtoService,
                DockerService,
                ContainerService
            ]
        }).build();
    });

    it("should...", async (): Promise<void> => {
        const modemService = context.get(ModemService);

        expect(modemService.modem).toBeInstanceOf(Modem);
    });
});
