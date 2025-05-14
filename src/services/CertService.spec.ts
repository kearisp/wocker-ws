import {describe, it, expect, beforeEach} from "@jest/globals";
import {ApplicationContext} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {
    AppConfigService,
    ProxyService,
    CertService,
    LogService
} from "./";
import {DockerService, ModemService} from "../modules";
import {DATA_DIR} from "../env";


describe("CertService", () => {
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test.createTestingModule({
            providers: [
                AppConfigService,
                CertService,
                ProxyService,
                DockerService,
                ModemService,
                LogService
            ]
        });
    });

    it("should return map of certificates with their extensions", async () => {
        vol.fromJSON({
            "certs/projects/test.crt": "",
            "certs/projects/test.key": "",
            "certs/projects/test2.crt": "",
            "certs/projects/test2.key": ""
        }, DATA_DIR);

        const certService = context.get(CertService);

        const certsMap = await certService.getCertsMap();

        expect(certsMap).toEqual({
            test: [".crt", ".key"],
            test2: [".crt", ".key"]
        });
    });

    it("should display formatted table with certificate names", async () => {
        vol.fromJSON({
            "certs/projects/test.crt": "",
            "certs/projects/test.key": "",
            "certs/projects/test2.crt": "",
            "certs/projects/test2.key": ""
        }, DATA_DIR);

        const certService = context.get(CertService);

        const list = await certService.list();

        expect(list).toMatchInlineSnapshot(`\n"[90m┌───────┐[39m\n[90m│[39m[31m Name  [39m[90m│[39m\n[90m├───────┤[39m\n[90m│[39m test  [90m│[39m\n[90m├───────┤[39m\n[90m│[39m test2 [90m│[39m\n[90m└───────┘[39m"\n`);
    });
});
