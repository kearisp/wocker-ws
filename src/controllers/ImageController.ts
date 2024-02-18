import CliTable from "cli-table3";
import {Cli} from "@kearisp/cli";

import {DI, Controller, Docker} from "../makes";
import {AppConfigService} from "../services";


class ImageController extends Controller {
    protected appConfigService: AppConfigService;

    public constructor(di: DI) {
        super();

        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
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
