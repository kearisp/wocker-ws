import CliTable from "cli-table3";
import {Cli} from "@kearisp/cli";

import {Controller, Docker} from "src/makes";


class ImageController extends Controller {
    public constructor() {
        super();
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("images")
            .action(() => this.list());
    }

    public async list() {
        const images = await Docker.imageLs({});

        const table = new CliTable({
            head: ["Name"]
        });

        for(const image of images) {
            table.push([image.Id]);
        }

        return table.toString() + "\n";
    }
}


export {ImageController};
