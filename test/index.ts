import {jest} from "@jest/globals";
import {vol} from "memfs";


const DATA_DIR = "/home/wocker-test/.workspace",
      PRESETS_DIR = "/wocker/presets";

const reset = vol.reset.bind(vol);
vol.reset = (): void => {
    reset();

    vol.mkdirSync(DATA_DIR, {
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
        DATA_DIR,
        PRESETS_DIR
    };
});
jest.mock("fs", () => vol);
jest.mock("fs/promises", () => vol.promises);

jest.doMock(`${DATA_DIR}/wocker.config.js`, () => {
    return {
        get config() {
            const file = vol.readFileSync(`${DATA_DIR}/wocker.config.js`).toString();

            return eval(file);
        }
    };
}, {
    virtual: true
});
