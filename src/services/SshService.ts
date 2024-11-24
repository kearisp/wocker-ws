import {Injectable} from "@wocker/core";
import * as Path from "path";

import {DockerService} from "./DockerService";
import {PLUGINS_DIR} from "../env";


@Injectable()
export class SshService {
    protected image = "wocker-ssh:1.0.0";
    protected container = "wocker-ssh";

    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async start(restart?: boolean, rebuild?: boolean) {
        if(restart || rebuild) {
            await this.dockerService.removeContainer(this.container);
        }

        let container = await this.dockerService.getContainer(this.container);

        if(!container) {
            await this.build(rebuild);

            container = await this.dockerService.createContainer({
                name: this.container,
                image: this.image,
                restart: "always",
                ports: [
                    "22:22"
                ]
            });
        }

        const {
            //
        } = await container.inspect();
    }

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.container);
    }

    public async build(rebuild?: boolean): Promise<void> {
        let exists = await this.dockerService.imageExists(this.image);

        if(rebuild && exists) {
            await this.dockerService.imageRm(this.image);

            exists = false;
        }

        if(exists) {
            return;
        }

        await this.dockerService.buildImage({
            tag: this.image,
            context: Path.join(PLUGINS_DIR, "ssh"),
            src: "./Dockerfile"
        });
    }
}
