import * as Path from "path";
import {Cli} from "@kearisp/cli";

import {DATA_DIR, PLUGINS_DIR} from "src/env";
import {Controller} from "src/makes/Controller";
import {FS} from "src/makes/FS";


class Plugin extends Controller {
    protected certsDir: string;
    protected dataDir: string;
    protected pluginDir: string;

    public constructor(name: string) {
        super();

        this.certsDir = Path.join(DATA_DIR, "certs");
        this.dataDir = Path.join(DATA_DIR, "plugins", name);
        this.pluginDir = Path.join(PLUGINS_DIR, name);
    }

    public install(cli: Cli) {
        super.install(cli);

        if(!FS.existsSync(this.certsDir)) {
            FS.mkdirSync(this.certsDir, {
                recursive: true
            });
        }

        if(!FS.existsSync(this.dataDir)) {
            FS.mkdirSync(this.dataDir, {
                recursive: true
            });
        }
    }

    public certsPath(...paths: string[]) {
        return Path.join(this.certsDir, ...paths);
    }

    public dataPath(...paths: string[]) {
        return Path.join(this.dataDir, ...paths);
    }

    public pluginPath(...paths: string[]) {
        return Path.join(this.pluginDir, ...paths);
    }
}


export {Plugin};
