import * as crypto from "crypto";


export class Encryptor {
    protected _salt: Buffer;
    protected _hash?: string;

    public constructor(hash?: string, salt?: string) {
        this._hash = hash;
        this._salt = salt
            ? Buffer.from(salt, "hex")
            : crypto.randomBytes(16);
    }

    public get hash(): string {
        return this._hash;
    }

    public get salt(): string {
        return this._salt.toString("hex");
    }

    public setPassword(password: string): this {
        return this;
    }

    public encrypt() {

    }

    public decrypt() {

    }
}
