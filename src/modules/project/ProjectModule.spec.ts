import {describe, expect, it, beforeEach, afterEach, jest} from "@jest/globals";
import {vol} from "memfs";
import {
    Injectable,
    AppService,
    AppConfigService,
    EventService,
    AppFileSystemService,
    LogService,
    ProcessService,
    PROJECT_TYPE_IMAGE
} from "@wocker/core";
import {Test, ModemMock, Fixtures} from "@wocker/testing";
import {AppModule} from "../app";
import {PresetModule} from "../preset";
import {KeystoreModule} from "../keystore";
import {DockerModule, DockerService, ImageService, ModemService} from "../docker";
import {ProjectModule} from "./";
import {DATA_DIR, ROOT_DIR} from "../../env";


describe("ProjectModule", (): void => {
    const TEST_IMAGE_PROJECT_DIR = `${ROOT_DIR}/fixtures/projects/image-project`;

    beforeEach((): void => {
        vol.reset();

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
        }, DATA_DIR);

        jest.spyOn(process, "cwd").mockImplementation((): string => {
            return TEST_IMAGE_PROJECT_DIR;
        });
    });

    afterEach((): void => {
        jest.resetAllMocks();
    });

    const getContext = async () => {
        const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`);

        @Injectable("MODEM_SERVICE")
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
                    AppModule,
                    PresetModule,
                    ProjectModule,
                    KeystoreModule,
                    DockerModule
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
                    AppConfigService,
                    EventService,
                    AppFileSystemService,
                    LogService,
                    ProcessService
                ]
            })
            .overrideProvider(ModemService)
            .useProvider(TestModemService)
            .build();
    };

    it("should start image project", async (): Promise<void> => {
        const context = await getContext();

        const imageService = context.get(ImageService),
              dockerService = context.get<DockerService>(DockerService);

        const writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        await context.run(["/bin/node", "/bin/ws", "start"]);

        writeSpy.mockReset();

        let container = await dockerService.getContainer("test.workspace");

        await expect(imageService.exists("php:8.3-apache")).resolves.toBeTruthy();
        expect(container).not.toBeNull();

        await context.run(["/bin/node", "/bin/ws", "stop"]);

        // container = await dockerService.getContainer("test.workspace");
        // expect(container).toBeNull();
    });
});
