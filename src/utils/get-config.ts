import {MAP_PATH} from "../env";
import {Config} from "../types";
import {FS} from "../makes/FS";


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
