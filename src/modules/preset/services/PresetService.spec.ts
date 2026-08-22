import {describe, it, expect, beforeEach, jest} from "@jest/globals";
import {PresetSource, AppService, FILE_SYSTEM_DRIVER_KEY, WOCKER_DATA_DIR_KEY} from "@wocker/core";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {PresetService} from "./PresetService";
import {PresetRepository} from "../repositories/PresetRepository";
import {GithubClient} from "../../../makes/GithubClient";
import {WOCKER_DATA_DIR} from "../../../env";


jest.mock("../../../makes/GithubClient");

const MockedGithubClient: any = GithubClient;

const PRESET_NAME = "test-preset";


describe("PresetService.install", (): void => {
    const tag = (name: string) => ({
        name,
        zipball_url: "",
        tarball_url: "",
        commit: {sha: "", url: ""},
        node_id: ""
    });

    let tags: ReturnType<typeof tag>[] = [];

    beforeEach((): void => {
        vol.reset();

        tags = [];

        MockedGithubClient.prototype.getTags = jest.fn(async () => tags as any);
        MockedGithubClient.prototype.getBranches = jest.fn(async () => []);

        MockedGithubClient.prototype.getFile = jest.fn(async (ref: string) => {
            return {
                name: PRESET_NAME,
                version: ref.replace(/^v/, "")
            };
        });

        MockedGithubClient.prototype.download = jest.fn(async (ref: string, dirPath: string) => {
            vol.mkdirSync(dirPath, {recursive: true});
            vol.writeFileSync(`${dirPath}/config.json`, JSON.stringify({
                name: PRESET_NAME,
                version: ref.replace(/^v/, "")
            }));
        });
    });

    const getContext = async () => {
        return Test
            .createTestingModule({
                providers: [
                    PresetService,
                    PresetRepository
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .build();
    };

    it("installs a preset for the first time into a version-scoped directory", async (): Promise<void> => {
        tags.push(tag("v1.0.0"));

        const context = await getContext(),
              presetService = context.get(PresetService),
              appService = context.get(AppService);

        await presetService.install("owner/repo");

        expect(appService.config.presets).toEqual([]);

        const config = JSON.parse(vol.readFileSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}@1.0.0/config.json`).toString());

        expect(config.name).toBe(PRESET_NAME);
    });

    it("installs a new version alongside an already installed one instead of replacing it", async (): Promise<void> => {
        tags.push(tag("v1.0.0"));
        tags.push(tag("v1.1.0"));

        const context = await getContext(),
              presetService = context.get(PresetService),
              appService = context.get(AppService);

        await presetService.install("owner/repo", "1.0.0");

        expect(appService.config.presets).toEqual([]);
        expect(vol.existsSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}@1.0.0/config.json`)).toBeTruthy();

        await presetService.install("owner/repo", "1.1.0");

        expect(appService.config.presets).toEqual([]);
        expect(vol.existsSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}@1.1.0/config.json`)).toBeTruthy();
    });

    it("does not redownload an exact version that is already installed, even when the tag has a \"v\" prefix", async (): Promise<void> => {
        tags.push(tag("v1.0.0"));

        const context = await getContext(),
              presetService = context.get(PresetService);

        await presetService.install("owner/repo", "1.0.0");

        const downloadCalls = MockedGithubClient.prototype.download;

        expect(downloadCalls).toHaveBeenCalledTimes(1);

        await presetService.install("owner/repo", "1.0.0");

        expect(downloadCalls).toHaveBeenCalledTimes(1);
    });

    it("migrates a legacy unversioned installation to the versioned layout and updates the registry", async (): Promise<void> => {
        vol.fromJSON({
            "wocker.config.json": JSON.stringify({
                presets: [
                    {name: PRESET_NAME, source: PresetSource.GITHUB}
                ]
            }),
            [`presets/${PRESET_NAME}/config.json`]: JSON.stringify({
                name: PRESET_NAME,
                version: "1.0.0"
            })
        }, WOCKER_DATA_DIR);

        tags.push(tag("v1.1.0"));

        const context = await getContext(),
              presetService = context.get(PresetService),
              appService = context.get(AppService);

        await presetService.install("owner/repo", "1.1.0");

        expect(appService.config.presets).toEqual([
            {name: PRESET_NAME, source: PresetSource.GITHUB}
        ]);
        expect(vol.existsSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}`)).toBeFalsy();
        expect(vol.existsSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}@1.0.0/config.json`)).toBeTruthy();
        expect(vol.existsSync(`${WOCKER_DATA_DIR}/presets/${PRESET_NAME}@1.1.0/config.json`)).toBeTruthy();
    });
});
