import {describe, it, jest, expect, beforeEach, afterEach} from "@jest/globals";
import {SpiedFunction} from "jest-mock";
import {
    PRESET_SOURCE_EXTERNAL,
    AppConfigService,
    EventService,
    LogService,
    AppService,
    AppFileSystemService,
    ProcessService,
    ApplicationContext
} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";


describe("PresetController", (): void => {
    let context: ApplicationContext,
        promptMap: any = {},
        cwdMock: SpiedFunction;

    beforeEach(async (): Promise<void> => {
        cwdMock = jest.spyOn(process, "cwd");
        cwdMock.mockReturnValue("/home/wocker-test/preset");

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

        const {AppModule} = await import("../../app");
        const {KeystoreModule} = await import("../../keystore");
        const {DockerModule} = await import("../../docker");
        const {ProjectModule} = await import("../../project");
        const {PresetModule} = await import("../../preset");
        const {PresetController} = await import("./PresetController");

        context = await Test
            .createTestingModule({
                imports: [
                    AppModule,
                    KeystoreModule,
                    DockerModule,
                    ProjectModule,
                    PresetModule
                ],
                controllers: [
                    PresetController
                ],
                providers: [
                    AppService,
                    AppConfigService,
                    AppFileSystemService,
                    EventService,
                    LogService,
                    ProcessService
                ],
                exports: [
                    AppService,
                    AppFileSystemService,
                    AppConfigService,
                    EventService,
                    LogService,
                    ProcessService
                ]
            })
            .build();
    });

    afterEach(() => {
        cwdMock.mockReset();

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
