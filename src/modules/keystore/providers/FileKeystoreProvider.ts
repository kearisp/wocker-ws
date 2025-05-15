import {Injectable, KeystoreProvider} from "@wocker/core";
import {promptInput} from "@wocker/utils";
// noinspection ES6PreferShortImport
import {AppConfigService} from "../../../services/AppConfigService";
import {FileKeystore} from "../types/FileKeystore";
import {encrypt, decrypt, verifyPasswordHash, createPasswordHash, createEncryptionKey} from "../utils";


@Injectable()
export class FileKeystoreProvider extends KeystoreProvider {
    protected password?: string;
    protected encryptionKey?: Buffer;
    protected _keystore?: FileKeystore;

    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {
        super();
    }

    protected get keystore(): FileKeystore {
        if(!this._keystore) {
            const fs = this.appConfigService.fs;

            let data: any = {
                secrets: {}
            };

            if(fs.exists("wocker.keystore.js")) {
                try {
                    data = {
                        ...require(fs.path("wocker.keystore.js"))
                    };
                }
                catch(err) {
                    // console.error(err.message);
                }
            }

            this._keystore = new class extends FileKeystore {
                public save(): void {
                    if(!fs.exists()) {
                        fs.mkdir("");
                    }

                    fs.writeFile("wocker.keystore.js", this.toString());
                }
            }(data);
        }

        return this._keystore;
    }

    protected get passwordHash(): string | undefined {
        return this.keystore.passwordHash;
    }

    protected async getEncryptionKey(): Promise<Buffer> {
        if(!this.encryptionKey) {
            const password = await promptInput({
                required: true,
                min: 6,
                max: 32,
                message: "Keystore password",
                type: "password",
                validate: async (value) => {
                    if(typeof value !== "string" || !this.passwordHash || verifyPasswordHash(value, this.passwordHash)) {
                        return true;
                    }

                    return "Invalid password";
                }
            });

            if(!this.keystore.passwordHash) {
                this.keystore.passwordHash = createPasswordHash(password);
                this.keystore.save();
            }

            this.encryptionKey = createEncryptionKey(password, this.keystore.passwordHash);
        }

        return this.encryptionKey;
    }

    public async get(key: string, defaultValue?: string): Promise<string|undefined> {
        const value = this.keystore.get(key);

        if(!value) {
            return defaultValue;
        }

        const encryptionKey = await this.getEncryptionKey();

        return decrypt(encryptionKey, value);
    }

    public async set(key: string, value: string): Promise<void> {
        const encryptionKey = await this.getEncryptionKey();

        this.keystore.set(key, encrypt(encryptionKey, value));
        this.keystore.save();
    }

    public async delete(key: string): Promise<void> {
        this.keystore.delete(key);
        this.keystore.save();
    }
}
