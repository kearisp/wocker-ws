import {MAP_PATH} from "src/env";
import {Config} from "src/types";
import {FS} from "src/makes/FS";


export const getConfig = async (): Promise<Config> => {
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
