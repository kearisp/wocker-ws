type VersionData = {
    major: number;
    minor: number;
    patch: number;
    tag?: string;
    build?: number;
};

export class Version {
    public static readonly REGEXP = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+(?:-[a-zA-Z0-9]+)*)(?:\.(\d+))?)?/;
    protected static cache: Map<string, Version> = new Map();

    public readonly major: number;
    public readonly minor: number;
    public readonly patch: number;
    public readonly tag?: string;
    public readonly build?: number;

    public constructor(data: VersionData) {
        Object.assign(this, data);
    }

    public parts(): number[] {
        return [
            this.major,
            this.minor,
            this.patch,
            this.build ?? 0
        ];
    }

    public compare(version: string | Version): number {
        if(typeof version === "string") {
            version = Version.parse(version);
        }

        const a = this.parts(),
              b = version.parts();

        for(let i = 0; i < Math.max(a.length, b.length); i++) {
            if(i === 3) {
                if(this.tag && !version.tag)
                    return -1;
                else if(!this.tag && version.tag)
                    return 1;
                else if(this.tag !== version.tag)
                    return this.tag < version.tag ? -1 : 1;
            }

            const diff = (a[i] ?? 0) - (b[i] ?? 0);

            if(diff !== 0) {
                return diff > 0 ? 1 : -1;
            }
        }

        return 0;
    }

    public static valid(version: string): boolean {
        return Version.REGEXP.test(version);
    }

    public static parse(version: string): Version {
        if(!Version.cache.has(version)) {
            if(!Version.REGEXP.test(version)) {
                throw new RangeError("Invalid version format");
            }

            const [,
                major,
                minor,
                patch,
                tag,
                build
            ] = Version.REGEXP.exec(version) || [];

            Version.cache.set(version, new Version({
                major: parseInt(major),
                minor: parseInt(minor),
                patch: parseInt(patch),
                tag,
                build: build ? parseInt(build): undefined
            }));
        }

        return Version.cache.get(version);
    }
}
