import {Injectable, KeystoreProvider} from "@wocker/core";
import {Keytar} from "../types/Keytar";
import {KEYTAR_SERVICE} from "../../../env";


@Injectable()
export class KeytarKeystoreProvider extends KeystoreProvider {
    protected _keytar?: any;

    public async get(key: string, defaultValue?: string): Promise<string | undefined> {
        const keytar = await this.getKeytar();

        const value = await keytar.getPassword(KEYTAR_SERVICE, key);

        return value || defaultValue;
    }

    public async set(key: string, value: string): Promise<void> {
        const keytar = await this.getKeytar();

        try {
            await keytar.setPassword(KEYTAR_SERVICE, key, value);
        }
        catch(err) {
            console.log(err.message);
        }
    }

    public async delete(key: string): Promise<void> {
        const keytar = await this.getKeytar();

        await keytar.deletePassword(KEYTAR_SERVICE, key);
    }

    protected async getKeytar(): Promise<Keytar> {
        if(!this._keytar) {
            this._keytar = await import("keytar");
        }

        return this._keytar;
    }
}
