import {describe, it, jest, expect, beforeAll, afterAll, beforeEach} from "@jest/globals";
import {
    PRESET_SOURCE_EXTERNAL,
    AppConfigService,
    ApplicationContext,
    FILE_SYSTEM_DRIVER_KEY,
    WOCKER_DATA_DIR_KEY,
    ProcessService
} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {WOCKER_DATA_DIR} from "../../../env";


describe("PresetController", (): void => {
    let context: ApplicationContext,
        promptMap: any = {};

    beforeAll((): void => {
        const prompt = ({message}) => {
            return promptMap[message];
        };

        jest.mock("@wocker/utils", () => {
            const utils: any = jest.requireActual("@wocker/utils");

            return {
                ...utils,
                promptInput: prompt,
                promptSelect: prompt,
                promptConfirm: prompt
            };
        });
    });

    beforeEach(async (): Promise<void> => {

        const {CoreModule} = await import("../../core");
        const {KeystoreModule} = await import("../../keystore");
        const {DockerModule} = await import("../../docker");
        const {ProjectModule} = await import("../../project");
        const {PresetModule} = await import("../../preset");
        const {PresetController} = await import("./PresetController");

        context = await Test
            .createTestingModule({
                imports: [
                    CoreModule,
                    KeystoreModule,
                    DockerModule,
                    ProjectModule,
                    PresetModule
                ],
                controllers: [
                    PresetController
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .build();

        const processService = context.get(ProcessService);

        vol.mkdirSync("/home/wocker-test/preset", {
            recursive: true
        });

        processService.chdir("/home/wocker-test/preset");
    });

    afterAll((): void => {
        jest.unmock("@wocker/utils");
    });

    it("preset:init", async (): Promise<void> => {
        vol.fromJSON({
            "Dockerfile": "FROM node:latest\n"
        }, "/home/wocker-test/preset");

        promptMap = {
            "Preset name": "test",
            "Preset version": "1.0.0",
            "Preset type": "dockerfile",
            "Preset dockerfile": "Dockerfile",
            "Correct": true
        };

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
