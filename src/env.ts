export {
    WOCKER_VERSION
} from "@wocker/core";
import OS from "os";
import Path from "path";


export const WOCKER_DATA_DIR: string = process.env.WS_DIR || Path.join(OS.homedir(), ".workspace");
export const ROOT_DIR = Path.join(__dirname, "..");
export const PRESETS_DIR = Path.join(ROOT_DIR, "presets");
export const PLUGINS_DIR = Path.join(ROOT_DIR, "plugins");
export const VIRTUAL_HOST_KEY = "VIRTUAL_HOST";
export const KEYTAR_SERVICE: string = process.env.WOCKER_KEYTAR_SERVICE || "wocker";
