import {describe, beforeEach, it, expect} from "@jest/globals";
import Modem from "docker-modem";
import {ApplicationContext} from "@wocker/core";
import {Test} from "@wocker/testing";
import {ModemService} from "./ModemService";
import {DockerService} from "./DockerService";
import {ContainerService} from "./ContainerService";


describe("ModemService", () => {
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test.createTestingModule({
            providers: [
                ModemService,
                DockerService,
                ContainerService
            ]
        });
    });

    it("should...", async () => {
        const modemService = context.get(ModemService);

        expect(modemService.modem).toBeInstanceOf(Modem);
    });
});
