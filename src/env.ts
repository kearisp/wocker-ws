import * as OS from "os";
import * as Path from "path";


export const WOCKER_VERSION = "1.0.25";
export const NODE_ENV = process.env.NODE_ENV;
export const ROOT_DIR = Path.join(__dirname, "..");
export const PRESETS_DIR = Path.join(ROOT_DIR, "fixtures/presets");
export const PLUGINS_DIR = Path.join(ROOT_DIR, "fixtures/plugins");
export const WOCKER_DATA_DIR = process.env.WS_DIR || Path.join(OS.homedir(), ".workspace");
export const VIRTUAL_HOST_KEY = "VIRTUAL_HOST";
export const KEYTAR_SERVICE: string = process.env.WOCKER_KEYTAR_SERVICE || "wocker";
