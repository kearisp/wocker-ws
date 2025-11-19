import {describe, expect, it, beforeEach, jest} from "@jest/globals";
import {vol} from "memfs";
import {
    FileSystem,
    ProcessService,
    PROJECT_TYPE_IMAGE,
    WOCKER_DATA_DIR_KEY,
    FILE_SYSTEM_DRIVER_KEY
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {DockerService, ImageService, Fixtures} from "@wocker/docker-mock-module";
import {Test} from "@wocker/testing";
import {PresetModule} from "../preset";
import {KeystoreModule} from "../keystore";
import {ProjectModule} from "./";
import {WOCKER_DATA_DIR, ROOT_DIR} from "../../env";


describe("ProjectModule", (): void => {
    const fs = new FileSystem(`${ROOT_DIR}/fixtures`),
          fixtures = Fixtures.fromFS(fs);
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
    });

    const getContext = async () => {
        return Test
            .createTestingModule({
                imports: [
                    DockerModule,
                    PresetModule,
                    ProjectModule,
                    KeystoreModule
                ],
                exports: [
                    ImageService,
                    DockerService
                ]
            })
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();
    };

    it("should start image project", async (): Promise<void> => {
        const context = await getContext();

        const imageService = context.get(ImageService),
              dockerService = context.get<DockerService>(DockerService),
              processService = context.get(ProcessService);

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

        // expect(container).toBeNull();
    });
});
