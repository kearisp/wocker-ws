const compareVersions = (a: string, b: string) => {
    const va = a.split("."),
          vb = b.split(".");

    for(let i = 0; i < Math.min(va.length, vb.length); i++) {
        if(va[i] === "x") {
            continue;
        }


    }
};

const parseVersion = (version: string) => {
    const [core, prerelease] = version.split("-");

    const [major, minor, patch] = core
        .replace(/^v/, "")
        .split(".");

    const [tag, build] = prerelease ? prerelease.split(".") : [];

    return {
        major,
        minor,
        patch,
        tag,
        build
    };
};

export const versionMatch = (pattern: string, version: string) => {
    const [, prefix, base = ""] = /^(\^|~|<|>|<=|>=)?(.*)$/.exec(pattern) || [];

    const b = parseVersion(base),
          {major, minor, patch, tag, build} = parseVersion(version);

    switch(prefix) {
        case "~":
            return major === b.major && minor === b.minor && patch >= b.patch;

        case "^":
            if(b.tag) {
                return tag === b.tag
                    && major === b.major
                    && minor === b.minor
                    && patch === b.patch
                    && (!b.build || build >= b.build);
            }

            return major === b.major
                && (minor > b.minor || (minor === b.minor && patch >= b.patch));

        case ">":
            return (major === b.major && minor === b.minor && patch > b.patch)
                || (major === b.major && minor > b.minor)
                || (major > b.major);

        case ">=":
            return (major === b.major && minor === b.minor && patch >= b.patch)
                || (major === b.major && minor >= b.minor)
                || (major >= b.major);

        case "<":
            return (major === b.major && minor === b.minor && patch < b.patch)
                || (major === b.major && minor < b.minor)
                || (major < b.major);

        case "<=":
            return (major === b.major && minor === b.minor && patch <= b.patch)
                || (major === b.major && minor < b.minor)
                || (major < b.major);
    }

    return false;
};
