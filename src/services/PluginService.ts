import {Cli, Injectable} from "@wocker/core";


@Injectable()
export class PluginService {
    public constructor(
        protected readonly cli: Cli
    ) {}

    public use(): void {
        // const controller = new Constructor(this.di);
        // controller.install(this.cli);
    }
}
