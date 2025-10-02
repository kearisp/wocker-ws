export type PackageInfo = {
    name: string;
    "dist-tags": {
        [tag: string]: string;
    };
    versions: {
        [version: string]: {
            name: string;
            version: string;
        };
    };
    time: {
        created: string;
        modified: string;
    } & {
        [version: string]: string;
    };
    readme: string;
    readmeFilename: string;
};
