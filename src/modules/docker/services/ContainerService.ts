import {Injectable} from "@wocker/core";
import {Container} from "dockerode";
import {DockerService} from "./DockerService";


@Injectable()
export class ContainerService {
    public constructor(
        protected readonly dockerService: DockerService
    ) {}

    public async get(name: string): Promise<Container> {
        const containers = await this.dockerService.docker.listContainers({
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

        return this.dockerService.docker.getContainer(container.Id);
    }
}
