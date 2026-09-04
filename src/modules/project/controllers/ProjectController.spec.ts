import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    AppService,
    ApplicationContext,
    ProcessService,
    ProjectType,
    FILE_SYSTEM_DRIVER_KEY,
    WOCKER_DATA_DIR_KEY
} from "@wocker/core";
import DockerModule from "@wocker/docker-module";
import DockerMockModule, {Fixtures} from "@wocker/docker-mock-module";
import {Test} from "@wocker/testing";
import {vol} from "memfs";
import {CoreModule} from "../../core";
import {KeystoreModule} from "../../keystore";
import {PresetModule} from "../../preset";
import {ProjectModule} from "../";
import {ROOT_DIR, WOCKER_DATA_DIR} from "../../../env";


describe("ProjectController", (): void => {
    const fixtures = Fixtures.fromPath(`${ROOT_DIR}/fixtures`);
    const TEST_PROJECT_DIR = "/home/wocker-test/projects/test";
    let context: ApplicationContext;

    beforeEach(async (): Promise<void> => {
        vol.reset();

        vol.fromJSON({
            "test.txt": ""
        }, TEST_PROJECT_DIR);

        vol.fromJSON({
            "projects/test/config.json": JSON.stringify({
                name: "test",
                type: ProjectType.IMAGE,
                imageName: "php:8.3-apache"
            }, null, 4),
            "wocker.config.json": JSON.stringify({
                projects: [
                    {
                        name: "test",
                        path: TEST_PROJECT_DIR
                    }
                ]
            }, null, 4)
        }, WOCKER_DATA_DIR);

        context = await Test
            .createTestingModule({
                imports: [
                    CoreModule,
                    KeystoreModule,
                    PresetModule,
                    ProjectModule
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .overrideModule(DockerModule).useModule(DockerMockModule.withFixtures(fixtures))
            .build();

        context.get(ProcessService).chdir(TEST_PROJECT_DIR);
    });

    it("should reject a host mount path that isn't allowed", async (): Promise<void> => {
        await expect(context.run([
            "node", "ws", "volume:mount", "/etc/wocker-data:/data"
        ])).rejects.toThrow("Mount path \"/etc/wocker-data\" is not allowed.");
    });

    it("should mount a host path once it's allowed", async (): Promise<void> => {
        const appService = context.get(AppService);

        appService.config.addMountAllow("/etc/wocker-data");
        appService.save();

        await context.run(["node", "ws", "volume:mount", "/etc/wocker-data:/data"]);

        const config = JSON.parse(vol.readFileSync(`${WOCKER_DATA_DIR}/projects/test/config.json`).toString());

        expect(config.volumes).toEqual(["/etc/wocker-data:/data"]);
    });

    it("should never check a named Docker volume", async (): Promise<void> => {
        await context.run(["node", "ws", "volume:mount", "pgsql-data:/var/lib/postgresql/data"]);

        const config = JSON.parse(vol.readFileSync(`${WOCKER_DATA_DIR}/projects/test/config.json`).toString());

        expect(config.volumes).toEqual(["pgsql-data:/var/lib/postgresql/data"]);
    });
});
