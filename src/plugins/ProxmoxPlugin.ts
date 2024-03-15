import {Controller, FSManager} from "@wocker/core";
import * as Path from "path";

import {
    AppConfigService,
    DockerService
} from "../services";
import {exec} from "../utils";


@Controller()
export class ProxmoxPlugin {
    protected configDir: string;
    protected fs: FSManager;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {
        this.configDir = this.appConfigService.dataPath("plugins/proxmox");
    }

    public pluginPath(...parts: string[]) {
        return Path.join(this.appConfigService.pluginsPath("proxmox"), ...parts);
    }

    public async up() {
        const container = await this.dockerService.getContainer("proxmox.workspace");

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
