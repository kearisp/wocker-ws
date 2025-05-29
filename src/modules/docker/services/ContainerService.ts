import {Injectable, LogService} from "@wocker/core";
import type Docker from "dockerode";
import type {Container} from "dockerode";
import {ModemService} from "./ModemService";


@Injectable()
export class ContainerService {
    public constructor(
        protected readonly logService: LogService,
        protected readonly modemService: ModemService
    ) {}

    public get docker(): Docker {
        return this.modemService.docker;
    }

    public async get(name: string): Promise<Container> {
        const containers = await this.docker.listContainers({
            all: true,
            filters: {
                name: [name]
            }
        });

        const container = containers.find((container) => {
            return container.Names.indexOf("/" + name) >= 0;
        });

        if(!container) {
            return null;
        }

        return this.docker.getContainer(container.Id);
    }

    public async rm(name: string): Promise<void> {
        const container = await this.get(name);

        if(!container) {
            return;
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "running" || Status === "restarting") {
            try {
                await container.stop();
            }
            catch(err) {
                this.logService.error("DockerService.removeContainer", err.message);
            }
        }

        try {
            await container.remove();
        }
        catch(err) {
            this.logService.error("DockerService.removeContainer: ", err.message);
        }
    }
}
