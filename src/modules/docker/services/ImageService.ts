import type Docker from "dockerode";
import {Injectable, FileSystem, DockerServiceParams as Params} from "@wocker/core";
import {ModemService} from "./ModemService";


@Injectable()
export class ImageService {
    public constructor(
        protected readonly modemService: ModemService
    ) {}

    public get docker(): Docker {
        return this.modemService.docker;
    }

    public async build(params: Params.BuildImage): Promise<void> {
        const {
            version,
            tag,
            context,
            labels,
            buildArgs
        } = params;

        const dockerfile = "dockerfile" in params
            ? params.dockerfile
            : params.src;

        const files = (new FileSystem(context)).readdir("", {
            recursive: true
        });

        const stream = await this.docker.buildImage({
            context,
            src: files
        }, {
            version,
            t: tag,
            labels,
            buildargs: Object.keys(buildArgs || {}).reduce((res, key) => {
                const value = buildArgs[key];

                if(typeof value !== "undefined") {
                    res[key] = typeof value !== "string" ? (value as any).toString() : value;
                }

                return res;
            }, {}),
            rm: true,
            dockerfile
        });

        await this.modemService.followProgress(stream);
    }

    public async exists(tag: string): Promise<boolean> {
        const image = this.docker.getImage(tag);

        try {
            await image.inspect();

            return true;
        }
        catch(err) {
            return false;
        }
    }

    public async pull(tag: string): Promise<void> {
        if(await this.exists(tag)) {
            return;
        }

        const stream = await this.docker.pull(tag);

        await this.modemService.followProgress(stream);
    }

    public async rm(tag: string, force: boolean = false): Promise<void> {
        if(!await this.exists(tag)) {
            return;
        }

        const image = this.docker.getImage(tag);

        await image.remove({
            force
        });
    }
}
