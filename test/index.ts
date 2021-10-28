import {DATA_DIR} from "../src/env";

jest.mock("fs", () => {
    const fs = jest.requireActual("fs");
    const Path = require("path");
    const {
        PRESETS_DIR,
        DATA_DIR
    } = require("src/env");

    const {
        fs: memfs,
        vol
    } = require("memfs");

    const readDir = (path) => {
        return fs.readdirSync(path).reduce((res, name) => {
            const fullPath = `${path}/${name}`;

            return {
                ...res,
                ...fs.lstatSync(fullPath).isFile() ? {
                    [fullPath]: fs.readFileSync(fullPath).toString()
                } : readDir(fullPath)
            };
        }, {});
    };

    vol.fromJSON(readDir(PRESETS_DIR));

    vol.fromJSON({
        [`${DATA_DIR}/.gitkeep`]: ""
    });

    vol.fromJSON({
        "./index.js": ""
    }, "/app");

    return memfs;
});

// jest.mock("inquirer", () => {
//     return {
//         prompt: async (params) => {
//             const {
//                 message,
//                 name
//             } = params;
//
//             let value = "";
//
//             switch(message) {
//                 case "Project name: ":
//                     value = "test";
//                     break;
//
//                 case "Project type: ":
//                     value = "preset";
//                     break;
//             }
//
//             // console.log(message, name, value);
//
//             return "test";
//         }
//     };
// });
