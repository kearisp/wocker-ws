import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    PresetSource,
    PRESET_SOURCE_INTERNAL,
    PRESET_SOURCE_EXTERNAL,
    PRESET_SOURCE_GITHUB,
    FILE_SYSTEM_DRIVER_KEY,
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
import {PresetRepository} from "./PresetRepository";
import {WOCKER_DATA_DIR, PRESETS_DIR, WOCKER_VERSION} from "../../../env";


describe("PresetRepository", (): void => {
    beforeEach((): void => {
        vol.reset();
    });

    const INTERNAL_1_NAME = "foo-1",
          INTERNAL_2_NAME = "foo-2",
          EXTERNAL_1_NAME = "ext-1",
          EXTERNAL_1_PATH = `/home/wocker-test/presets/${EXTERNAL_1_NAME}`,
          GITHUB_1_NAME = "github-1";

    const getContext = async () => {
        vol.fromJSON({
            "wocker.config.json": JSON.stringify({
                presets: [
                    {
                        name: EXTERNAL_1_NAME,
                        source: PRESET_SOURCE_EXTERNAL,
                        path: EXTERNAL_1_PATH
                    },
                    {
                        name: GITHUB_1_NAME,
                        source: PRESET_SOURCE_GITHUB
                    }
                ]
            }),
            [`presets/${GITHUB_1_NAME}/config.json`]: JSON.stringify({
                name: GITHUB_1_NAME,
                version: "1.1.1"
            })
        }, WOCKER_DATA_DIR);

        vol.fromJSON({
            "config.json": JSON.stringify({
                name: EXTERNAL_1_NAME,
                version: "1.0.0"
            })
        }, EXTERNAL_1_PATH);

        vol.fromJSON({
            [`${INTERNAL_1_NAME}/config.json`]: JSON.stringify({
                name: INTERNAL_1_NAME,
                version: "1.0.1"
            }),
            [`${INTERNAL_2_NAME}/config.json`]: JSON.stringify({
                name: INTERNAL_2_NAME,
                version: "1.0.2"
            })
        }, PRESETS_DIR);

        return await Test
            .createTestingModule({
                providers: [
                    PresetRepository
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .build();
    };

    it(`should search ${PRESET_SOURCE_INTERNAL} preset`, async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const preset = presetRepository.searchOne({
            name: INTERNAL_1_NAME
        });

        expect(preset).not.toBeNull();
        expect(preset.name).toBe(INTERNAL_1_NAME);
        expect(preset.version).toBe("1.0.1");
    });

    it(`should load ${PRESET_SOURCE_EXTERNAL} preset`, async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const preset = presetRepository.searchOne({
            name: EXTERNAL_1_NAME
        });

        expect(preset).not.toBeNull();
        expect(preset.name).toBe(EXTERNAL_1_NAME);
        expect(preset.source).toBe(PRESET_SOURCE_EXTERNAL);
    });

    it(`should load ${PRESET_SOURCE_GITHUB} preset`, async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const preset = presetRepository.searchOne({
            name: GITHUB_1_NAME
        });

        expect(preset).not.toBeNull();
        expect(preset.name).toBe(GITHUB_1_NAME);
    });

    it("should return all presets", async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const preset = presetRepository.searchOne();

        expect(preset).not.toBeNull();
    });

    it("should be not found", async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const presetByName = presetRepository.searchOne({
            name: "invalid-name"
        });

        expect(presetByName).toBeNull();

        const presetBySource = presetRepository.searchOne({
            source: "invalid-source" as PresetSource
        });

        expect(presetBySource).toBeNull();

        const presetByPath = presetRepository.searchOne({
            path: "/home/wocker-test/presets/not-found"
        });

        expect(presetByPath).toBeNull();

        vol.fromJSON({
            "config.json": "invalid json"
        }, EXTERNAL_1_PATH);

        const presetWithBrokenConfig = presetRepository.searchOne({
            name: EXTERNAL_1_NAME
        });

        expect(presetWithBrokenConfig).toBeNull();
    });

    it(`should be updatable ${PRESET_SOURCE_EXTERNAL} preset`, async () => {
        const context = await getContext(),
              presetRepository = context.get(PresetRepository);

        const preset = presetRepository.searchOne({
            name: EXTERNAL_1_NAME
        });

        preset.type = "dockerfile";
        preset.dockerfile = "./Dockerfile";
        preset.save();

        const data = JSON.parse(vol.readFileSync(`${EXTERNAL_1_PATH}/config.json`).toString());

        expect(data.name).toBe(EXTERNAL_1_NAME);
        expect(data.type).toBe("dockerfile");
        expect(data.dockerfile).toBe("./Dockerfile");
    });
});
