import {describe, it, expect, beforeEach} from "@jest/globals";
import {
    AppService,
    ApplicationContext,
    FILE_SYSTEM_DRIVER_KEY,
    WOCKER_DATA_DIR_KEY
} from "@wocker/core";
import {Test, promptsMock} from "@wocker/testing";
import {vol} from "memfs";
import {PermissionsModule} from "../";
import {WOCKER_DATA_DIR} from "../../../env";


describe("PermissionsController", (): void => {
    let context: ApplicationContext;

    beforeEach(async (): Promise<void> => {
        vol.reset();

        context = await Test
            .createTestingModule({
                imports: [
                    PermissionsModule
                ]
            })
            .overrideProvider(FILE_SYSTEM_DRIVER_KEY).useValue(vol)
            .overrideProvider(WOCKER_DATA_DIR_KEY).useValue(WOCKER_DATA_DIR)
            .build();
    });

    it("should allow and deny a non-sensitive path without confirmation", async (): Promise<void> => {
        const appService = context.get(AppService);

        await context.run(["node", "ws", "mount:allow", "/home/wocker-test/projects/test"]);

        expect(appService.config.permissions?.mounts?.allow).toEqual([
            "/home/wocker-test/projects/test"
        ]);

        await context.run(["node", "ws", "mount:deny", "/home/wocker-test/projects/test"]);

        expect(appService.config.permissions?.mounts?.allow).toBeUndefined();
        expect(appService.config.permissions?.mounts?.deny).toEqual([
            "/home/wocker-test/projects/test"
        ]);
    });

    it("should list no entries when nothing configured", async (): Promise<void> => {
        const result = await context.run(["node", "ws", "mount:allow"]);

        expect(result).toBe("No allowed mount paths");
    });

    it("should require the path to be retyped to allow a sensitive path", async (): Promise<void> => {
        const appService = context.get(AppService);

        promptsMock.setPromptMock({
            [[
                "",
                "You are granting mount access to a sensitive path:",
                "  /etc",
                "",
                "Type the path again to confirm"
            ].join("\n")]: "/etc"
        });

        await context.run(["node", "ws", "mount:allow", "/etc"]);

        expect(appService.config.permissions?.mounts?.allow).toEqual(["/etc"]);
    });

    it("should reject a mismatched confirmation for a sensitive path", async (): Promise<void> => {
        const appService = context.get(AppService);

        promptsMock.setPromptMock({
            [[
                "",
                "You are granting mount access to a sensitive path:",
                "  /etc",
                "",
                "Type the path again to confirm"
            ].join("\n")]: "/etcx"
        });

        await expect(context.run(["node", "ws", "mount:allow", "/etc"]))
            .rejects.toThrow("Confirmation doesn't match \"/etc\", aborting");

        expect(appService.config.permissions?.mounts?.allow).toBeUndefined();
    });
});
