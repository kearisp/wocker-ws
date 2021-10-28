import * as Path from "path";
import {Cli} from "@kearisp/cli";

import {Plugin, Docker} from "src/makes";
import {exec} from "src/utils";


export class ProxmoxPlugin extends Plugin {
    protected configDir: string;

    public constructor() {
        super("proxmox");

        this.configDir = Path.join(__dirname, "../../services/proxmox");
    }

    public install(cli: Cli) {
        super.install(cli);
    }

    public async up() {
        const container = await Docker.getContainer("proxmox.workspace");

        if(container) {
            await this.down();
        }

        await exec(`
            docker build \
                --tag "ws-proxmox" \
                --file "${this.pluginPath("./Dockerfile")}" \
                ${this.pluginPath()}
        `);

        // --add-host=""

        await exec(`
            docker run -d \
                --name proxmox.workspace \
                --network workspace \
                -e VIRTUAL_HOST=proxmox.workspace \
                -p 8006:8006 \
                ws-proxmox
        `);
    }

    public async down() {
        await exec("docker stop proxmox.workspace").catch(() => {
            //
        });

        await exec("docker rm proxmox.workspace").catch(() => {
            //
        });

        await exec("docker image rm ws-proxmox").catch(() => {
            //
        });
    }
}
