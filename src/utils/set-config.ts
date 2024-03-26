import {AppConfig} from "@wocker/core";

import {MAP_PATH} from "../env";
import {FS} from "../makes/FS";

import {getConfig} from "./get-config";


export const setConfig = async (data: Partial<AppConfig>): Promise<AppConfig> => {
    const config = {
        ...await getConfig(),
        ...data
    };

    await FS.writeJSON(MAP_PATH, config);

    return config;
};
