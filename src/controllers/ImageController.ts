import {Controller, Command} from "@wocker/core";
import CliTable from "cli-table3";

import {AppConfigService, DockerService} from "../services";


@Controller()
export class ImageController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {}

    @Command("images")
    public async list() {
        const images = await this.dockerService.imageLs({});

        const table = new CliTable({
            head: ["Name"]
        });

        for(const image of images) {
            table.push([image.Id]);
        }

        return table.toString();
    }
}
