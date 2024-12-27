import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);
const fsMkdir = promisify(fs.mkdir);
const fsAccess = promisify(fs.access);

export class Encryption {
    private algorithm = 'aes-256-gcm';
    private keyLength = 32; // 256 біт
    private ivLength = 16; // 128 біт
    private saltLength = 64;
    private tagLength = 16;

    /**
     * Отримати або згенерувати ключ шифрування
     */
    public async getEncryptionKey(keyPath: string, masterPassword: string): Promise<Buffer> {
        try {
            await fsAccess(path.dirname(keyPath));
        } catch (error) {
            await fsMkdir(path.dirname(keyPath), { recursive: true });
        }

        let salt: Buffer;

        try {
            // Спробувати прочитати існуючий сіль
            salt = await fsReadFile(keyPath);
        } catch (error) {
            // Якщо файл не існує, створити новий сіль
            salt = crypto.randomBytes(this.saltLength);
            await fsWriteFile(keyPath, salt);
        }

        // Генерувати ключ з мастер-пароля та солі
        return this.deriveKey(masterPassword, salt);
    }

    /**
     * Вивести ключ з мастер-пароля та солі
     */
    private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, this.keyLength, (err, derivedKey) => {
                if (err) reject(err);
                else resolve(derivedKey);
            });
        });
    }

    /**
     * Зашифрувати дані
     */
    // public encrypt(data: string, key: Buffer): Buffer {
    //     const iv = crypto.randomBytes(this.ivLength);
    //     const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
    //         authTagLength: this.tagLength
    //     });
    //
    //     const encrypted = Buffer.concat([
    //         cipher.update(data, 'utf8'),
    //         cipher.final()
    //     ]);
    //
    //     const authTag = cipher.getAuthTag();
    //
    //     // Формат: IV + AuthTag + EncryptedData
    //     return Buffer.concat([iv, authTag, encrypted]);
    // }

    /**
     * Розшифрувати дані
     */
    // public decrypt(encryptedData: Buffer, key: Buffer): string {
    //     const iv = encryptedData.subarray(0, this.ivLength);
    //     const authTag = encryptedData.subarray(this.ivLength, this.ivLength + this.tagLength);
    //     const ciphertext = encryptedData.subarray(this.ivLength + this.tagLength);
    //
    //     const decipher = crypto.createDecipheriv(this.algorithm, key, iv, {
    //         // authTagLength: this.tagLength
    //     });
    //     decipher.setAuthTag(authTag);
    //
    //     return Buffer.concat([
    //         decipher.update(ciphertext),
    //         decipher.final()
    //     ]).toString('utf8');
    // }
}
