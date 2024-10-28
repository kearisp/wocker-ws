import {
    Controller,
    Command,
    Cli
} from "@wocker/core";


@Controller()
export class CompletionController {
    public constructor(
        protected readonly cli: Cli
    ) {}

    @Command("completion script")
    public completion(): string {
        return this.cli.completionScript() + "\n";
    }
}
