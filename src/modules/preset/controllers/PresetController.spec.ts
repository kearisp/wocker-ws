import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    PRESET_SOURCE_EXTERNAL,
    AppConfigService,
    ApplicationContext,
    FILE_SYSTEM_DRIVER_KEY,
    WOCKER_DATA_DIR_KEY,
    ProcessService
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {Fixtures} from "@wocker/docker-mock-module";
import {Test, utilsMock} from "@wocker/testing";
import {vol} from "memfs";
import {CoreModule} from "../../core";
import {KeystoreModule} from "../../keystore";
import {ProjectModule} from "../../project";
import {PresetModule} from "../";
import {ROOT_DIR, WOCKER_DATA_DIR} from "../../../env";


describe("PresetController", (): void => {
    const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`);
    let context: ApplicationContext;

    beforeEach(async (): Promise<void> => {
        context = await Test
            .createTestingModule({
                imports: [
                    CoreModule,
                    KeystoreModule,
                    ProjectModule,
                    PresetModule
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();

        const processService = context.get(ProcessService);

        vol.mkdirSync("/home/wocker-test/preset", {
            recursive: true
        });

        processService.chdir("/home/wocker-test/preset");
    });

    it("preset:init", async (): Promise<void> => {
        vol.fromJSON({
            "Dockerfile": "FROM node:latest\n"
        }, "/home/wocker-test/preset");

        utilsMock.setPromptMock({
            "Preset name": "test",
            "Preset version": "1.0.0",
            "Preset type": "dockerfile",
            "Preset dockerfile": "Dockerfile",
            "Correct": true
        });

        const appConfigService = context.get(AppConfigService);

        await context.run(["node", "ws", "preset:init"]);

        const config = JSON.parse(vol.readFileSync("/home/wocker-test/preset/config.json").toString());

        expect(config).toEqual({
            name: "test",
            version: "1.0.0",
            type: "dockerfile",
            dockerfile: "Dockerfile"
        })
        expect(appConfigService.config.presets).toEqual([
            {
                name: "test",
                source: PRESET_SOURCE_EXTERNAL,
                path: "/home/wocker-test/preset"
            }
        ]);
    });
});
