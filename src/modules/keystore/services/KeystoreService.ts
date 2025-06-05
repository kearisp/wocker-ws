import {
    Injectable,
    KeystoreService as CoreKeystoreService,
    KeystoreProvider
} from "@wocker/core";
import {AppConfigService} from "../../../services/AppConfigService";
import {KeytarKeystoreProvider} from "./../providers/KeytarKeystoreProvider";
import {FileKeystoreProvider} from "./../providers/FileKeystoreProvider";


@Injectable("KEYSTORE_SERVICE")
export class KeystoreService extends CoreKeystoreService {
    protected providers: Map<string, KeystoreProvider>;

    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {
        super();

        this.providers = new Map();
    }

    public hasProvider(name: string): boolean {
        return ["file", "keytar"].includes(name);
    }

    public provider(name?: string): KeystoreProvider {
        if(!name) {
            name = this.appConfigService.config.keystore;
        }

        if(!name) {
            name = "file";
        }

        switch(name) {
            case "file":
                return new FileKeystoreProvider(this.appConfigService);

            case "keytar":
                return new KeytarKeystoreProvider();

            default:
                throw new Error(`Unknown keystore provider "${name}"`);
        }
    }

    public async get(keys: string | string[], byDefault?: string): Promise<string | undefined> {
        const provider = this.provider();

        if(Array.isArray(keys)) {
            for(const key of keys) {
                const value = await provider.get(key);

                if(value) {
                    return value;
                }
            }

            return byDefault;
        }

        return provider.get(keys, byDefault);
    }

    public async set(key: string, value: string): Promise<void> {
        const provider = this.provider();

        await provider.set(key, value);
    }

    public registerProvider(name: string, provider: KeystoreProvider) {
        if(this.providers.has(name)) {
            throw new Error(`Provider ${name} already registered`);
        }

        this.providers.set(name, provider);
    }
}
