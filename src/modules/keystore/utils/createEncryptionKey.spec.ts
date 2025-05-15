import {describe, it, expect} from "@jest/globals";
import crypto from "crypto";
import {createEncryptionKey} from "./createEncryptionKey";
import {createPasswordHash} from "./createPasswordHash";


describe("createEncryptionKey", () => {
    it("should generate deterministic keys with the same password and password hash", () => {
        const password = "Secret password";
        const passwordHash = createPasswordHash(password);

        const key1 = createEncryptionKey(password, passwordHash);
        const key2 = createEncryptionKey(password, passwordHash);

        expect(key1).toEqual(key2);
    });

    it("should throw error when password doesn't match the hash", () => {
        const passwordHash = createPasswordHash("correct password");

        expect(() => {
            createEncryptionKey("wrong password", passwordHash);
        }).toThrow("Invalid password provided");
    });

    it("should generate different keys with different password hashes", () => {
        const password = "Same password";
        const passwordHash1 = createPasswordHash(password);
        const passwordHash2 = createPasswordHash(password); // Різний salt буде згенеровано

        const key1 = createEncryptionKey(password, passwordHash1);
        const key2 = createEncryptionKey(password, passwordHash2);

        expect(key1).not.toEqual(key2);
    });

    it("should generate key of correct length (32 bytes)", () => {
        const password = "test password";
        const passwordHash = createPasswordHash(password);

        const key = createEncryptionKey(password, passwordHash);

        expect(key.length).toBe(32);
    });

    it("should handle empty password", () => {
        const password = "";
        const passwordHash = createPasswordHash(password);

        const key1 = createEncryptionKey(password, passwordHash);
        const key2 = createEncryptionKey(password, passwordHash);

        expect(key1).toEqual(key2);
    });

    it("should handle unicode passwords", () => {
        const password = "Пароль із символами 🔑 💻";
        const passwordHash = createPasswordHash(password);

        const key1 = createEncryptionKey(password, passwordHash);
        const key2 = createEncryptionKey(password, passwordHash);

        expect(key1).toEqual(key2);
    });

    it("should handle long passwords", () => {
        const longPassword = "a".repeat(1000);
        const passwordHash = createPasswordHash(longPassword);

        expect(() => createEncryptionKey(longPassword, passwordHash)).not.toThrow();
    });

    it("should throw error with malformed password hash", () => {
        const password = "test";
        // Некоректний формат хешу без сепаратора ":"
        const invalidHash = "invalidhashformat";

        expect(() => {
            createEncryptionKey(password, invalidHash);
        }).toThrow();
    });

    it("should throw error with empty password hash", () => {
        const password = "test";

        expect(() => {
            createEncryptionKey(password, "");
        }).toThrow();
    });

    it("should use the salt from password hash to derive key", () => {
        const password = "test";

        const salt1 = crypto.randomBytes(16).toString("hex");
        const salt2 = crypto.randomBytes(16).toString("hex");

        const hash1 = createPasswordHash(password, salt1);
        const hash2 = createPasswordHash(password, salt2);

        const key1 = createEncryptionKey(password, hash1);
        const key2 = createEncryptionKey(password, hash2);

        expect(key1).not.toEqual(key2);
    });
});
