import {
    Controller,
    Command,
    Option,
    Description
} from "@wocker/core";
import {DnsService} from "../services/DnsService";


@Controller()
@Description("DNS commands")
export class DnsController {
    public constructor(
        protected readonly dnsService: DnsService
    ) {}

    @Command("dns:start")
    @Description("Starting DNS service")
    public async start(
        @Option("restart", "r")
        restart?: boolean,
        @Option("rebuild", "b")
        rebuild?: boolean
    ): Promise<void> {
        await this.dnsService.start(restart, rebuild);
    }

    @Command("dns:stop")
    @Description("Stopping DNS service")
    public async stop(): Promise<void> {
        await this.dnsService.stop();
    }
}
