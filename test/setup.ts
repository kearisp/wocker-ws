import {jest} from "@jest/globals";
import * as fs from "fs";
import {vol} from "memfs";
import {Union} from "unionfs";


const WOCKER_DATA_DIR = "/home/wocker-test/.workspace",
      PRESETS_DIR = "/wocker/presets";

const ufs = (new Union()).use(vol as any).use(fs),
      reset = vol.reset.bind(vol);

vol.reset = (): void => {
    reset();

    vol.mkdirSync(WOCKER_DATA_DIR, {
        recursive: true
    });

    vol.mkdirSync(PRESETS_DIR, {
        recursive: true
    });

    vol.mkdirSync("/home/wocker-test/presets", {
        recursive: true
    });

    vol.mkdirSync("/home/wocker-test/projects", {
        recursive: true
    });
};

jest.mock("../src/env", () => {
    const env: any = jest.requireActual("../src/env");

    return {
        ...env,
        WOCKER_DATA_DIR,
        PRESETS_DIR
    };
});
jest.doMock("fs", () => ufs);
jest.doMock("fs/promises", () => ufs.promises);
jest.doMock("process", () => {
    const process: any = jest.requireActual("process");

    let pwd = WOCKER_DATA_DIR;

    return {
        ...process,
        pwd(): string {
            return pwd;
        },
        chdir(newPwd: string) {
            if(!ufs.existsSync(newPwd)) {
                throw new Error(`ENOENT: no such file or directory, chdir '${pwd}' -> '${newPwd}'`);
            }

            pwd = newPwd;
        }
    };
});

jest.doMock(`${WOCKER_DATA_DIR}/wocker.config.js`, () => {
    return {
        get config() {
            const file = vol.readFileSync(`${WOCKER_DATA_DIR}/wocker.config.js`).toString();

            return eval(file);
        }
    };
}, {
    virtual: true
});
