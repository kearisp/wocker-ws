import {describe, it, expect, jest} from "@jest/globals";
import {encrypt} from "./encrypt";
import crypto from "crypto";


describe("encrypt", () => {
    it("should encrypt a string value", () => {
        const encryptedKey = crypto.randomBytes(32); // 256-bit key
        const value = "test value";

        const encryptedValue = encrypt(encryptedKey, value);

        expect(encryptedValue).toBeDefined();
        expect(typeof encryptedValue).toBe("string");
        expect(encryptedValue.length).toBeGreaterThan(0);
    });

    it("should return different encrypted values for the same input due to random IV", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "same value";

        const encryptedValue1 = encrypt(encryptedKey, value);
        const encryptedValue2 = encrypt(encryptedKey, value);

        expect(encryptedValue1).not.toEqual(encryptedValue2);
    });

    it("should return base64 encoded string", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "test value";

        const encryptedValue = encrypt(encryptedKey, value);

        expect(() => Buffer.from(encryptedValue, "base64")).not.toThrow();
    });

    it("should include IV (12 bytes) and auth tag (16 bytes) in the output", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "test value";

        const encryptedValue = encrypt(encryptedKey, value);
        const encryptedBuffer = Buffer.from(encryptedValue, "base64");

        expect(encryptedBuffer.length).toBeGreaterThanOrEqual(12 + 16 + 1);
    });

    it("should handle empty string", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "";

        const encryptedValue = encrypt(encryptedKey, value);

        expect(encryptedValue).toBeDefined();
        expect(typeof encryptedValue).toBe("string");
        expect(encryptedValue.length).toBeGreaterThan(0);
    });

    it("should handle UTF-8 special characters", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "Спеціальні символи і емодзі 🔒 🔑";

        expect(() => {
            const encryptedValue = encrypt(encryptedKey, value);
            expect(encryptedValue).toBeDefined();
        }).not.toThrow();
    });

    it("should throw error with invalid key length", () => {
        const invalidKey = crypto.randomBytes(24);
        const value = "test value";

        expect(() => {
            encrypt(invalidKey, value);
        }).toThrow();
    });

    it("should handle long values", () => {
        const encryptedKey = crypto.randomBytes(32);
        const longValue = "a".repeat(10000);

        expect(() => {
            const encryptedValue = encrypt(encryptedKey, longValue);
            expect(encryptedValue).toBeDefined();
        }).not.toThrow();
    });

    it("should encrypt with AES-256-GCM algorithm", () => {
        const mockCreateCipheriv = jest.spyOn(crypto, "createCipheriv");
        const encryptedKey = crypto.randomBytes(32);
        const value = "test value";

        encrypt(encryptedKey, value);

        expect(mockCreateCipheriv).toHaveBeenCalledWith(
            "aes-256-gcm",
            expect.any(Buffer),
            expect.any(Buffer)
        );

        mockCreateCipheriv.mockRestore();
    });

    it("should use random IV for each encryption", () => {
        const encryptedKey = crypto.randomBytes(32);
        const value = "test value";

        const mockRandomBytes: any = jest.spyOn(crypto, "randomBytes");

        encrypt(encryptedKey, value);

        expect(mockRandomBytes).toHaveBeenCalledWith(12);

        mockRandomBytes.mockRestore();
    });
});
