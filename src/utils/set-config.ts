import {MAP_PATH} from "../env";
import {FS} from "../makes/FS";
import {Config} from "../types";

import {getConfig} from "./get-config";


export const setConfig = async (data: Partial<Config>): Promise<Config> => {
    const config = {
        ...await getConfig(),
        ...data
    };

    await FS.writeJSON(MAP_PATH, config);

    return config;
};
