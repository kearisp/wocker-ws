import {describe, it, expect} from "@jest/globals";
import {verifyPasswordHash} from "./verifyPasswordHash";
import {createPasswordHash} from "./createPasswordHash";


describe("verifyPasswordHash", () => {
    it("should return true for matching password and hash", () => {
        const password = "correct password",
              passwordHash = createPasswordHash(password);

        expect(verifyPasswordHash(password, passwordHash)).toBe(true);
    });

    it("should return false for incorrect password", () => {
        const passwordHash = createPasswordHash("correct password");

        expect(verifyPasswordHash("wrong password", passwordHash)).toBe(false);
    });

    it("should handle empty passwords", () => {
        const passwordHash = createPasswordHash("");

        expect(verifyPasswordHash("", passwordHash)).toBe(true);
        expect(verifyPasswordHash("not empty", passwordHash)).toBe(false);
    });

    it("should handle malformed password hash", () => {
        expect(verifyPasswordHash("password", "malformed-hash")).toBe(false);
    });

    it("should handle undefined or empty hash", () => {
        expect(verifyPasswordHash("password", "")).toBe(false);
        expect(verifyPasswordHash("password", undefined as any)).toBe(false);
    });
});
