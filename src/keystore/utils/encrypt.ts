import crypto from "crypto";


export const encrypt = (encryptedKey: Buffer, value: string): string => {
    const iv = crypto.randomBytes(12),
          cipher = crypto.createCipheriv("aes-256-gcm", encryptedKey, iv);

    let encrypted = cipher.update(value, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, "base64")
    ]).toString("base64");
}

