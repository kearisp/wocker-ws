import type Docker from "dockerode";
import {Injectable, FileSystem} from "@wocker/core";
import {ModemService} from "./ModemService";


type BuildParams = {
    tag: string;
    context: string;
    dockerfile: string;
    version: "1" | "2";
};

@Injectable()
export class ImageService {
    public constructor(
        protected readonly modemService: ModemService
    ) {}

    public get docker(): Docker {
        return this.modemService.docker;
    }

    public async build(params: BuildParams): Promise<void> {
        const {
            tag,
            context,
            dockerfile,
            version
        } = params;

        const files = (new FileSystem(context)).readdir("", {
            recursive: true
        });

        const stream = await this.docker.buildImage({
            context,
            src: files
        }, {
            t: tag,
            dockerfile,
            version
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
