import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    ApplicationContext,
    WOCKER_VERSION_KEY,
    WOCKER_DATA_DIR_KEY,
    FILE_SYSTEM_DRIVER_KEY
} from "@wocker/core";
import {Test, ProcessMockService} from "@wocker/testing";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {Fixtures, ImageService} from "@wocker/docker-mock-module";
import * as fs from "fs";
import {vol} from "memfs";
import {Union} from "unionfs";
import {ProxyService} from "./ProxyService";
import {CertService} from "./CertService";
import {ROOT_DIR, WOCKER_DATA_DIR, WOCKER_VERSION} from "../../../env";


describe("ProxyService", () => {
    let context: ApplicationContext;

    beforeEach(async () => {
        vol.reset();

        const ufs = (new Union()).use(vol as any).use(fs);

        const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`)

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
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(ufs)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();
    });

    it("should build proxy", async () => {
        const proxyService = context.get(ProxyService),
              processService = context.get(ProcessMockService),
              imageService = context.get(ImageService);

        let data = "";

        processService.stdout.on("data", (chunk) => {
            data += chunk.toString();
        });

        await proxyService.build();

        expect(data).toContain("Successfully tagged");

        const [image] = await imageService.list();

        expect(image).not.toBeNull();

        if(image) {
            expect(image.RepoTags[0]).toMatch(/wocker-proxy:\d+\.\d+\.\d+/);
        }
    });
});
