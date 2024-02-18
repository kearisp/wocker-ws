import {Cli} from "@kearisp/cli";
import axios from "axios";
import chalk from "chalk";

import {DI, Controller, Logger} from "../makes";
import {AppConfigService, PluginService} from "../services";
import {exec} from "../utils";


type AddOptions = {};
type RemoveOptions = {};

class PluginController extends Controller {
    protected appConfigService: AppConfigService;
    protected pluginService: PluginService;

    public constructor(di: DI) {
        super();

        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
        this.pluginService = di.resolveService<PluginService>(PluginService);
    }

    public install(cli: Cli): void {
        super.install(cli);

        cli.command("plugin:add <name>")
            .action((options, name: string) => this.add(options, name));

        cli.command("plugin:remove <name>")
            .action((options, name: string) => this.remove(options, name));
    }

    public async add(options: AddOptions, addName: string) {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(addName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        try {
            const {default: Plugin} = await import(fullName);

            this.pluginService.use(Plugin);

            await this.appConfigService.activatePlugin(fullName);

            console.info(`Plugin ${fullName} activated`);
            return;
        }
        catch(err) {
            Logger.error(err.message);
        }

        try {
            const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(fullName)}`, {
                validateStatus: () => true
            });

            if(res.status !== 200) {
                console.error(chalk.red(`Plugin ${fullName} not found`));
                return;
            }

            console.info(`Installing ${fullName}`);

            await exec(`npm install -g ${fullName}`);

            await this.appConfigService.activatePlugin(fullName);
        }
        catch(err) {
            Logger.error(err.message);
        }
    }

    public async remove(options: RemoveOptions, removeName: string) {
        const [,
            prefix = "@wocker/",
            name,
            suffix = "-plugin"
        ] = /^(@wocker\/)?(\w+)(-plugin)?$/.exec(removeName) || [];

        const fullName = `${prefix}${name}${suffix}`;

        await this.appConfigService.deactivatePlugin(fullName);

        console.info(`Plugin ${fullName} deactivated`);
    }
}


export {PluginController};
