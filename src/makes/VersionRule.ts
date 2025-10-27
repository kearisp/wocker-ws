import {Version} from "./Version";


type VersionRuleData = {
    prefix?: string;
    major?: number;
    minor?: number;
    patch?: number;
    tag?: string;
    build?: number;
};

export class VersionRule {
    public static readonly REGEXP = /^(?:(\^|~|<=|>=|<|>)?(x|\d+)(?:\.(\*|x|\d+))?(?:\.(x|\d+))?(?:-([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)(?:\.(\d+))?)?|([a-zA-Z0-9]+(?:-[a-zAZ0-9]+)*))$/;
    protected static map: Map<string, VersionRule> = new Map();

    public readonly prefix?: string;
    public readonly major?: number;
    public readonly minor?: number;
    public readonly patch?: number;
    public readonly tag?: string;
    public readonly build?: number;

    public constructor(data: VersionRuleData) {
        Object.assign(this, data);
    }

    public get version(): Version {
        return new Version({
            major: this.major ?? 0,
            minor: this.minor ?? 0,
            patch: this.patch ?? 0,
            tag: this.tag,
            build: this.build
        });
    }

    public match(version: string | Version, withTag?: boolean): boolean {
        if(typeof version === "string") {
            version = Version.parse(version);
        }

        if((!withTag || this.tag) && this.tag !== version.tag) {
            return false;
        }

        const cmp = version.compare(this.version);

        switch(this.prefix) {
            case ">":
                return cmp > 0;

            case ">=":
                return cmp >= 0;

            case "<":
                return cmp < 0;

            case "<=":
                return cmp <= 0;

            case "^":
                return (
                    this.major === version.major &&
                    cmp >= 0
                );

            case "~":
                return (
                    this.major === version.major &&
                    this.minor === version.minor &&
                    cmp >= 0
                );

            default:
                return (
                    (this.major === undefined || this.major === version.major) &&
                    (this.minor === undefined || this.minor === version.minor) &&
                    (this.patch === undefined || this.patch === version.patch)
                );
        }
    }

    public static parse(rule: string): VersionRule {
        if(!VersionRule.map.has(rule)) {
            if(!VersionRule.REGEXP.test(rule)) {
                throw new Error("Invalid version rule");
            }

            const [,
                prefix,
                major,
                minor,
                patch,
                tag,
                build,
                onlyTag
            ] = VersionRule.REGEXP.exec(rule) || [];

            VersionRule.map.set(rule, new VersionRule({
                prefix,
                major: major && major !== "x" && major !== "*" ? parseInt(major) : undefined,
                minor: minor && minor !== "x" ? parseInt(minor) : undefined,
                patch: patch && patch !== "x" ? parseInt(patch) : undefined,
                tag: tag || onlyTag,
                build: build && build !== "x" ? parseInt(build) : undefined
            }));
        }

        return VersionRule.map.get(rule);
    }
}
