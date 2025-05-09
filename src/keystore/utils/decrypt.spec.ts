import {describe, it, expect, jest} from "@jest/globals";
import crypto from "crypto";
import {decrypt, encrypt} from "./";


describe("decrypt", () => {
    it("should decrypt an encrypted value correctly", () => {
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "test value";

        const encrypted = encrypt(encryptionKey, originalValue);
        const decrypted = decrypt(encryptionKey, encrypted);

        expect(decrypted).toBe(originalValue);
    });

    it("should throw error when using wrong encryption key", () => {
        const correctKey = crypto.randomBytes(32);
        const wrongKey = crypto.randomBytes(32);
        const originalValue = "secret message";

        const encrypted = encrypt(correctKey, originalValue);

        expect(() => {
            decrypt(wrongKey, encrypted);
        }).toThrow("Unsupported state or unable to authenticate data");
    });

    it("should throw error with malformed encrypted value", () => {
        const encryptionKey = crypto.randomBytes(32);
        const malformedValue = "not-valid-base64!";

        expect(() => {
            decrypt(encryptionKey, malformedValue);
        }).toThrow();
    });

    it("should throw error with corrupted encrypted value", () => {
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "test value";

        const encrypted = encrypt(encryptionKey, originalValue);
        // Пошкоджуємо зашифровані дані
        const corruptedEncrypted = encrypted.substring(0, encrypted.length - 5) + "XXXXX";

        expect(() => {
            decrypt(encryptionKey, corruptedEncrypted);
        }).toThrow();
    });

    it("should decrypt empty string value", () => {
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "";

        const encrypted = encrypt(encryptionKey, originalValue);
        const decrypted = decrypt(encryptionKey, encrypted);

        expect(decrypted).toBe(originalValue);
    });

    it("should decrypt UTF-8 special characters", () => {
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "Спеціальні символи і емодзі 🔒 🔑";

        const encrypted = encrypt(encryptionKey, originalValue);
        const decrypted = decrypt(encryptionKey, encrypted);

        expect(decrypted).toBe(originalValue);
    });

    it("should throw error with invalid key length", () => {
        const invalidKey = crypto.randomBytes(24); // AES-256 потребує 32-байтовий ключ
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "test value";

        const encrypted = encrypt(encryptionKey, originalValue);

        expect(() => {
            decrypt(invalidKey, encrypted);
        }).toThrow();
    });

    it("should decrypt long values", () => {
        const encryptionKey = crypto.randomBytes(32);
        const longValue = "a".repeat(10000);

        const encrypted = encrypt(encryptionKey, longValue);
        const decrypted = decrypt(encryptionKey, encrypted);

        expect(decrypted).toBe(longValue);
    });

    it("should use AES-256-GCM algorithm for decryption", () => {
        const mockCreateDecipheriv = jest.spyOn(crypto, "createDecipheriv");
        const encryptionKey = crypto.randomBytes(32);
        const originalValue = "test value";

        const encrypted = encrypt(encryptionKey, originalValue);
        decrypt(encryptionKey, encrypted);

        expect(mockCreateDecipheriv).toHaveBeenCalledWith(
            "aes-256-gcm",
            expect.any(Buffer),
            expect.any(Buffer)
        );

        mockCreateDecipheriv.mockRestore();
    });

    it("should set auth tag correctly", () => {
        // Створюємо моки для decipher об'єкта
        const mockSetAuthTag = jest.fn();
        const mockUpdate = jest.fn().mockReturnValue("decrypted");
        const mockFinal = jest.fn().mockReturnValue("");

        // Мокуємо createDecipheriv, щоб повертати наш mock decipher
        const mockDecipher = {
            setAuthTag: mockSetAuthTag,
            update: mockUpdate,
            final: mockFinal
        };

        const mockCreateDecipheriv = jest.spyOn(crypto, "createDecipheriv")
            .mockReturnValue(mockDecipher as any);

        const encryptionKey = crypto.randomBytes(32);
        const encrypted = encrypt(crypto.randomBytes(32), "test"); // Використовуємо інший ключ, оскільки результат не важливий

        try {
            decrypt(encryptionKey, encrypted);
        } catch (error) {
            // Ігноруємо помилки, оскільки нас цікавить лише виклик setAuthTag
        }

        expect(mockSetAuthTag).toHaveBeenCalled();

        mockCreateDecipheriv.mockRestore();
    });

    // it("should extract IV, auth tag and encrypted data correctly", () => {
    //     const encryptionKey = crypto.randomBytes(32);
    //     const originalValue = "test extraction";
    //
    //     // Створюємо власні мок-функції для перевірки правильності розділення даних
    //     const originalCreateDecipheriv = crypto.createDecipheriv;
    //
    //     crypto.createDecipheriv = jest.fn((algorithm: any, key: any, iv: any) => {
    //         // Перевіряємо, що iv має правильний розмір
    //         expect(iv.length).toBe(12);
    //
    //         return originalCreateDecipheriv(algorithm, key, iv);
    //     }) as any;
    //
    //     // Мокуємо setAuthTag для перевірки розміру authTag
    //     const originalSetAuthTag = crypto.Decipher.prototype.setAuthTag;
    //     crypto.Decipher.prototype.setAuthTag = jest.fn(function(authTag: any) {
    //         expect(authTag.length).toBe(16); // Перевіряємо, що authTag має правильний розмір
    //         return originalSetAuthTag.call(this, authTag);
    //     });
    //
    //     const encrypted = encrypt(encryptionKey, originalValue);
    //     decrypt(encryptionKey, encrypted);
    //
    //     expect(crypto.createDecipheriv).toHaveBeenCalled();
    //     expect(crypto.Decipher.prototype.setAuthTag).toHaveBeenCalled();
    //
    //     // Відновлюємо оригінальні функції
    //     crypto.createDecipheriv = originalCreateDecipheriv;
    //     crypto.Decipher.prototype.setAuthTag = originalSetAuthTag;
    // });

    // it("should log error before throwing", () => {
    //     const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    //     const encryptionKey = crypto.randomBytes(32);
    //     const malformedValue = "invalid-data";
    //
    //     try {
    //         decrypt(encryptionKey, malformedValue);
    //     } catch (error) {
    //         // Очікуємо помилку
    //     }
    //
    //     expect(consoleErrorSpy).toHaveBeenCalledWith(
    //         "Помилка розшифрування:",
    //         expect.any(String)
    //     );
    //
    //     consoleErrorSpy.mockRestore();
    // });
});
