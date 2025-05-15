import {describe, it, jest, expect, beforeEach, afterEach} from "@jest/globals";
import {SpiedFunction} from "jest-mock";
import {PRESET_SOURCE_EXTERNAL} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {PresetRepository} from "../repositories";
import {KeystoreService} from "../modules";


describe("PresetController", () => {
    let cwdMock: SpiedFunction;
    let promptMap = {};

    beforeEach(() => {
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
    });

    afterEach(() => {
        cwdMock.mockReset();

        jest.unmock("@wocker/utils");
    });

    it("preset:init", async () => {
        const {AppConfigService} = await import("../services/AppConfigService");
        const {AppEventsService} = await import("../services/AppEventsService");
        const {ProjectService} = await import("../services/ProjectService");
        const {LogService} = await import("../services/LogService");
        const {PresetService} = await import("../services/PresetService");
        const {
            ModemService,
            DockerService
        } = await import("../modules");
        const {
            PresetController
        } = await import("./PresetController");

        const context = await Test.createTestingModule({
            controllers: [
                PresetController
            ],
            providers: [
                AppConfigService,
                AppEventsService,
                ProjectService,
                PresetRepository,
                PresetService,
                LogService,
                KeystoreService,
                DockerService,
                ModemService
            ]
        });

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
