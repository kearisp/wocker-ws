import {describe, it, expect, beforeEach, afterEach, jest} from "@jest/globals";
import {FileSystem, ApplicationContext} from "@wocker/core";
import {Test, Fixtures, ModemMock} from "@wocker/testing";
import {ROOT_DIR} from "../../../env";
import {ModemService} from "./ModemService";
import {ImageService} from "./ImageService";
import {ProtoService} from "./ProtoService";


describe("ImageService", (): void => {
    const fs = new FileSystem(`${ROOT_DIR}/fixtures`),
          fixtures = Fixtures.fromFS(fs);

    let context: ApplicationContext;

    beforeEach(async (): Promise<void> => {
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

        context = await Test
            .createTestingModule({
                providers: [
                    ImageService,
                    ModemService,
                    ProtoService
                ]
            })
            .overrideProvider(ModemService)
            .useProvider(TestModemService)
            .build()
    });

    afterEach((): void => {
        jest.resetAllMocks();
    });

    it("should build image", async (): Promise<void> => {
        const imageService = context.get(ImageService);
        const spyWrite = jest.spyOn(process.stdout, "write");

        spyWrite.mockImplementation(() => true);

        await imageService.build({
            tag: "dockerfile-project:latest",
            context: fs.path("projects/dockerfile-project"),
            dockerfile: "Dockerfile",
            version: "1"
        });

        expect(spyWrite).toHaveBeenCalled();
        spyWrite.mockReset();

        await expect(imageService.exists("dockerfile-project:latest")).resolves.toBeTruthy();
    });

    it("should ", async (): Promise<void> => {
        const imageService = context.get(ImageService);

        const imageName = "php:8.3-apache";

        const spyWrite = jest.spyOn(process.stdout, "write");

        spyWrite.mockImplementation(() => true);

        await expect(imageService.exists(imageName)).resolves.toBeFalsy();
        await imageService.pull(imageName);
        await expect(imageService.exists(imageName)).resolves.toBeTruthy();
        await imageService.rm(imageName);
        await expect(imageService.exists(imageName)).resolves.toBeFalsy();
    });
});
