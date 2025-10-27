import {
    Controller,
    Command,
    Option
} from "@wocker/core";
import {DnsService} from "../services/DnsService";


@Controller()
export class DnsController {
    public constructor(
        protected readonly dnsService: DnsService
    ) {}

    @Command("dns:start")
    public async start(
        @Option("restart", "r")
        restart?: boolean,
        @Option("rebuild", "b")
        rebuild?: boolean
    ): Promise<void> {
        await this.dnsService.start(restart, rebuild);
    }

    @Command("dns:stop")
    public async stop(): Promise<void> {
        await this.dnsService.stop();
    }
}
