import crypto from "crypto";


export const decrypt = (encryptedKey: Buffer, encryptedValue: string): string => {
    const buffer = Buffer.from(encryptedValue, "base64"),
          iv = buffer.subarray(0, 12),
          authTag = buffer.subarray(12, 28),
          encrypted = buffer.subarray(28).toString("base64"),
          decipher = crypto.createDecipheriv("aes-256-gcm", encryptedKey, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};
