import {AppConfig} from "@wocker/core";

import {MAP_PATH} from "../env";
import {FS} from "../makes/FS";


export const getConfig = async (): Promise<AppConfig> => {
    return FS.readJSON(MAP_PATH).catch((err) => {
        if(err.code === "ENOENT") {
            return Promise.resolve({
                env: {},
                projects: []
            });
        }

        throw err;
    });
};
