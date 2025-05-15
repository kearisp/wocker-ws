type Secrets = Record<string, string>;

type Props = {
    passwordHash?: string;
    secrets?: Secrets;
};

export abstract class FileKeystore {
    public passwordHash?: string;
    protected secrets: Secrets;

    public constructor(data: Props) {
        const {
            passwordHash,
            secrets = {}
        } = data;

        this.passwordHash = passwordHash;
        this.secrets = secrets;
    }

    public abstract save(): void;

    public get(key: string): string | undefined {
        if(!(key in this.secrets)) {
            return undefined;
        }

        return this.secrets[key];
    }

    public set(key: string, value: string): void {
        this.secrets[key] = value;
    }

    public delete(key: string): void {
        if(!(key in this.secrets)) {
            return;
        }

        delete this.secrets[key];
    }

    public toObject() {
        return {};
    }

    public toString() {
        const secrets = JSON.stringify(this.secrets, null, 4);

        return `// Wocker keystore\nexports.passwordHash = "${this.passwordHash}";\nexports.secrets = ${secrets};\n`;
    }
}
