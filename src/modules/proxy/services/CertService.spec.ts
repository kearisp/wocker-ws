import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    ApplicationContext,
    AppConfigService,
    LogService,
    AppService,
    AppFileSystemService,
    ProcessService,
    WOCKER_VERSION_KEY,
    WOCKER_DATA_DIR_KEY
} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {CertService} from "./CertService";
import {ProxyService} from "./ProxyService";
import {
    DockerModule,
    ContainerService,
    DockerService,
    ImageService,
    ModemService,
    ProtoService
} from "../../docker";
import {WOCKER_DATA_DIR, WOCKER_VERSION} from "../../../env";


describe("CertService", (): void => {
    let context: ApplicationContext;

    beforeEach(async () => {
        context = await Test.createTestingModule({
            imports: [
                // DockerModule
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
                AppFileSystemService,
                AppConfigService,
                CertService,
                ProxyService,
                DockerService,
                ModemService,
                LogService,
                ProtoService,
                ImageService,
                ContainerService,
                ProcessService
            ]
        }).build();
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
