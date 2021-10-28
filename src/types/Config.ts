export type Config = {
    debug?: boolean;
    env: {
        [key: string]: string;
    };
    projects: {
        id: string;
        name?: string;
        src: string;
    }[];
};
