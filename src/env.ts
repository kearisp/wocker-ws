import * as OS from "os";
import * as Path from "path";


export const NODE_ENV = process.env.NODE_ENV;
export const ROOT_DIR = Path.join(__dirname, "..");
export const PRESETS_DIR = Path.join(ROOT_DIR, "presets");
export const SERVICES_DIR = Path.join(ROOT_DIR, "services");
export const PLUGINS_DIR = Path.join(ROOT_DIR, "plugins");
export const DATA_DIR = process.env.WS_DIR || Path.join(OS.homedir(), ".workspace");
export const MAP_PATH = Path.join(DATA_DIR, "data.json");
export const VIRTUAL_HOST_KEY = "VIRTUAL_HOST";
