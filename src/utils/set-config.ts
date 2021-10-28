import {MAP_PATH} from "src/env";
import {FS} from "src/makes/FS";
import {Config} from "src/types";

import {getConfig} from "./get-config";


export const setConfig = async (data: Partial<Config>): Promise<Config> => {
    const config = {
        ...await getConfig(),
        ...data
    };

    await FS.writeJSON(MAP_PATH, config);

    return config;
};
