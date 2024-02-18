import {Cli} from "@wocker/core";
import {DI, Controller} from "../makes";


class PluginService {
    protected cli: Cli;

    public constructor(
        protected di: DI
    ) {
        this.cli = di.resolveService<Cli>(Cli);
    }

    public use(Constructor: {new (...params: any[]): Controller}): void {
        const controller = new Constructor(this.di);

        controller.install(this.cli);
    }
}


export {PluginService};
