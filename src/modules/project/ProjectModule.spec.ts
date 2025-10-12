import {describe, expect, it, beforeEach, afterEach, jest} from "@jest/globals";
import {vol} from "memfs";
import {
    ProcessService,
    Injectable,
    PROJECT_TYPE_IMAGE,
    WOCKER_DATA_DIR_KEY,
    FILE_SYSTEM_DRIVER_KEY
} from "@wocker/core";
import {Test, ModemMock, Fixtures} from "@wocker/testing";
import {PresetModule} from "../preset";
import {KeystoreModule} from "../keystore";
import {DockerModule, DockerService, ImageService, ModemService} from "../docker";
import {ProjectModule} from "./";
import {WOCKER_DATA_DIR, ROOT_DIR} from "../../env";


describe("ProjectModule", (): void => {
    const TEST_IMAGE_PROJECT_DIR = `${ROOT_DIR}/fixtures/projects/image-project`;

    beforeEach((): void => {
        vol.reset();

        vol.fromJSON({
            "test.txt": ""
        }, TEST_IMAGE_PROJECT_DIR);

        vol.fromJSON({
            "projects/test/config.json": JSON.stringify({
                name: "test",
                type: PROJECT_TYPE_IMAGE,
                imageName: "php:8.3-apache"
            }, null, 4),
            "wocker.config.json": JSON.stringify({
                projects: [
                    {
                        name: "test",
                        path: TEST_IMAGE_PROJECT_DIR
                    }
                ]
            }, null, 4)
        }, WOCKER_DATA_DIR);

        jest.spyOn(process, "cwd").mockImplementation((): string => {
            return TEST_IMAGE_PROJECT_DIR;
        });
    });

    afterEach((): void => {
        jest.resetAllMocks();
    });

    const getContext = async () => {
        const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`);

        @Injectable("DOCKER_MODEM_SERVICE")
        class TestModemService extends ModemService {
            protected _modem?: ModemMock;

            public get modem(): ModemMock {
                if(!this._modem) {
                    this._modem = new ModemMock({
                        mockFixtures: fixtures
                    });
                }

                return this._modem;
            }
        }

        return Test
            .createTestingModule({
                imports: [
                    PresetModule,
                    ProjectModule,
                    KeystoreModule,
                    DockerModule
                ]
            })
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(ModemService).useProvider(TestModemService)
            .build();
    };

    it("should start image project", async (): Promise<void> => {
        const context = await getContext();

        const imageService = context.get(ImageService),
              processService = context.get(ProcessService),
              dockerService = context.get<DockerService>(DockerService);

        processService.chdir(TEST_IMAGE_PROJECT_DIR);

        const writeSpy = jest.spyOn(process.stdout, "write")
            .mockImplementation(() => true);

        await context.run(["/bin/node", "/bin/ws", "start"]);

        writeSpy.mockReset();

        let container = await dockerService.getContainer("test.workspace");

        await expect(imageService.exists("php:8.3-apache")).resolves.toBeTruthy();
        expect(container).not.toBeNull();

        await context.run(["/bin/node", "/bin/ws", "stop"]);

        // container = await dockerService.getContainer("test.workspace");
        //
        // expect(container).toBeNull();
    });
});
