import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    ApplicationContext,
    WOCKER_VERSION_KEY,
    WOCKER_DATA_DIR_KEY,
    FILE_SYSTEM_DRIVER_KEY
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {Fixtures} from "@wocker/docker-mock-module";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {CertService} from "./CertService";
import {ProxyService} from "./ProxyService";
import {ROOT_DIR, WOCKER_DATA_DIR, WOCKER_VERSION} from "../../../env";


describe("CertService", (): void => {
    const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`);
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test
            .createTestingModule({
                imports: [
                    DockerModule
                ],
                providers: [
                    CertService,
                    ProxyService
                ]
            })
            .overrideProvider(WOCKER_VERSION_KEY).useValue(WOCKER_VERSION)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();
    });

    it("should return map of certificates with their extensions", async () => {
        vol.fromJSON({
            "certs/projects/test.crt": "",
            "certs/projects/test.key": "",
            "certs/projects/test2.crt": "",
            "certs/projects/test2.key": ""
        }, WOCKER_DATA_DIR);

        const certService = context.get(CertService);

        const certsMap = certService.getCertsMap();

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
        }, WOCKER_DATA_DIR);

        const certService = context.get(CertService);

        const list = await certService.list();

        expect(list).toMatchInlineSnapshot(`\n"[90m┌───────┐[39m\n[90m│[39m[31m Name  [39m[90m│[39m\n[90m├───────┤[39m\n[90m│[39m test  [90m│[39m\n[90m├───────┤[39m\n[90m│[39m test2 [90m│[39m\n[90m└───────┘[39m"\n`);
    });
});
