import {
    Injectable,
    FileSystem,
    LogService
} from "@wocker/core";
import YAML from "yaml";
import * as compose from "docker-compose";


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

        const fs = new FileSystem(context),
              config: any = fs.readYAML(composefile);

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

        const res = await compose.upAll({
            cwd: context,
            configAsString: YAML.stringify(config),
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
            config: composefile,
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

    protected processChunk(chunk: Buffer<ArrayBuffer>, streamSource?: "stdout" | "stderr"): void {
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
