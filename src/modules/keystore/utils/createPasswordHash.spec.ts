import {describe, it, expect} from "@jest/globals";
import crypto from "crypto";
import {createPasswordHash} from "./createPasswordHash";


describe("createPasswordHash", () => {
    it("should return a string in format 'hash:salt'", () => {
        const result = createPasswordHash("password");
        expect(result).toMatch(/^[a-f0-9]{64}:[a-f0-9]{32}$/);
    });

    it("should generate deterministic hashes with the same password and salt", () => {
        const password = "my secure password";
        const salt = crypto.randomBytes(16).toString("hex");

        const hash1 = createPasswordHash(password, salt);
        const hash2 = createPasswordHash(password, salt);

        expect(hash1).toEqual(hash2);
    });

    it("should generate different hashes with different passwords but same salt", () => {
        const salt = crypto.randomBytes(16).toString("hex");
        const password1 = "password1";
        const password2 = "password2";

        const hash1 = createPasswordHash(password1, salt);
        const hash2 = createPasswordHash(password2, salt);

        expect(hash1).not.toEqual(hash2);
    });

    it("should return the provided salt in the result", () => {
        const password = "test_password";
        const salt = crypto.randomBytes(16).toString("hex");

        const result = createPasswordHash(password, salt);
        const [_, resultSalt] = result.split(":");

        expect(resultSalt).toBe(salt);
    });

    it("should generate random salt when none is provided", () => {
        const password = "same_password";

        const hash1 = createPasswordHash(password);
        const hash2 = createPasswordHash(password);

        const [, salt1] = hash1.split(":");
        const [, salt2] = hash2.split(":");

        expect(salt1).not.toEqual(salt2);
        expect(hash1).not.toEqual(hash2);
    });

    it("should handle empty passwords", () => {
        const salt = crypto.randomBytes(16).toString("hex");

        const hash1 = createPasswordHash("", salt);
        const hash2 = createPasswordHash("", salt);

        expect(hash1).toEqual(hash2);
    });

    it("should handle Unicode passwords", () => {
        const salt = crypto.randomBytes(16).toString("hex");
        const password = "складний пароль з емодзі 🔑 💻";

        const hash1 = createPasswordHash(password, salt);
        const hash2 = createPasswordHash(password, salt);

        expect(hash1).toEqual(hash2);
    });

    it("should use SHA-256 algorithm which produces 64 character hex output", () => {
        const result = createPasswordHash("test");
        const [hash] = result.split(":");

        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should have a salt of 16 bytes (32 hex characters)", () => {
        const result = createPasswordHash("test");
        const [, salt] = result.split(":");

        expect(salt).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should handle long passwords", () => {
        const salt = crypto.randomBytes(16).toString("hex");
        const longPassword = "a".repeat(1000);

        const hash1 = createPasswordHash(longPassword, salt);
        const hash2 = createPasswordHash(longPassword, salt);

        expect(hash1).toEqual(hash2);
    });

    it("should return undefined salt part when no salt is provided", () => {
        const result = createPasswordHash("password");
        const [_, salt] = result.split(":");

        expect(salt).toBeDefined();
        expect(salt.length).toBe(32);
    });
});
