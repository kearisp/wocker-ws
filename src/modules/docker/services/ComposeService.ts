import {
    Injectable,
    FileSystem,
    LogService
} from "@wocker/core";
import YAML from "yaml";
import * as compose from "docker-compose";
import {ComposeConfig} from "../type/ComposeConfig";


type UpOptions = {
    composefile: string;
    context: string;
};

type DownOptions = {
    composefile: string;
    context: string;
};

type BuildOptions = {
    composefile: string;
    context: string;
};

type ExecOptions = {
    service: string;
    args: string[];
    composefile: string;
    context: string;
};

@Injectable("DOCKER_COMPOSE_SERVICE")
export class ComposeService {
    public constructor(
        protected readonly logService: LogService
    ) {}

    public async up(options: UpOptions): Promise<void> {
        const {
            context,
            composefile
        } = options;

        const res = await compose.upAll({
            cwd: context,
            configAsString: this.getConfigAsString(context, composefile),
            callback: (chunk, streamSource) => this.processChunk(chunk, streamSource)
        });

        this.logService.debug("compose up", res);
    }

    public async down(options: DownOptions): Promise<void> {
        const {
            context,
            composefile
        } = options;

        const res = await compose.downAll({
            cwd: context,
            configAsString: this.getConfigAsString(context, composefile),
            callback: (chunk, streamSource) => this.processChunk(chunk, streamSource)
        });

        this.logService.debug("compose down", res);
    }

    public async build(options: BuildOptions): Promise<void> {
        const {
            context,
            composefile
        } = options;

        const res = await compose.buildAll({
            cwd: context,
            config: composefile,
            callback: (chunk, streamSource) => this.processChunk(chunk, streamSource)
        });

        this.logService.debug("build", res);
    }

    public async exec(options: ExecOptions): Promise<void> {
        const {
            service,
            args,
            context,
            composefile
        } = options;

        await compose.exec(service, args, {
            configAsString: this.getConfigAsString(context, composefile),
            callback: (chunk, streamSource) => this.processChunk(chunk, streamSource)
        });
    }

    protected getConfig(context: string, composefile: string): ComposeConfig {
        const fs = new FileSystem(context),
              config: ComposeConfig = fs.readYAML(composefile);

        if(!config.networks) {
            config.networks = {};
        }

        config.networks.workspace = {
            external: true
        };

        for(const name in config.services) {
            if(!config.services[name].networks) {
                config.services[name].networks = [];
            }

            if(!config.services[name].networks.includes("workspace")) {
                config.services[name].networks.push("workspace");
            }
        }

        return config;
    }

    protected getConfigAsString(context: string, composefile: string): string {
        const config = this.getConfig(context, composefile);

        return YAML.stringify(config);
    }

    protected processChunk(chunk: Buffer<ArrayBufferLike>, streamSource?: "stdout" | "stderr"): void {
        switch(streamSource) {
            case "stdout":
                process.stdout.write(chunk);
                break;

            case "stderr":
                process.stderr.write(chunk);
                break;
        }
    }
}
