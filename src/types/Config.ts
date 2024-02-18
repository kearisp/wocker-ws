import {EnvConfig} from "./EnvConfig";


export type Config = {
    debug?: boolean;
    meta: EnvConfig;
    env: EnvConfig;
    plugins: string[];
    projects: {
        id: string;
        name?: string;
        src: string;
    }[];
};
