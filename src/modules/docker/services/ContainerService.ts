import {
    Injectable,
    LogService,
    DockerServiceParams as Params
} from "@wocker/core";
import type Docker from "dockerode";
import {Duplex} from "stream";
import type {Container} from "dockerode";
import {ModemService} from "./ModemService";


@Injectable()
export class ContainerService {
    public constructor(
        protected readonly logService: LogService,
        protected readonly modemService: ModemService
    ) {}

    public get docker(): Docker {
        return this.modemService.docker;
    }

    public async get(name: string): Promise<Container> {
        const containers = await this.docker.listContainers({
            all: true,
            filters: {
                name: [name]
            }
        });

        const container = containers.find((container) => {
            return container.Names.indexOf("/" + name) >= 0;
        });

        if(!container) {
            return null;
        }

        return this.docker.getContainer(container.Id);
    }

    public async rm(name: string): Promise<void> {
        const container = await this.get(name);

        if(!container) {
            return;
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "running" || Status === "restarting") {
            try {
                await container.stop();
            }
            catch(err) {
                this.logService.error("DockerService.removeContainer", err.message);
            }
        }

        try {
            await container.remove();
        }
        catch(err) {
            this.logService.error("DockerService.removeContainer: ", err.message);
        }
    }

    public async exec(nameOrContainer: string|Container, options: Params.Exec|string[], _tty?: boolean): Promise<Duplex> {
        const container: Container = typeof nameOrContainer === "string"
            ? await this.get(nameOrContainer)
            : nameOrContainer;

        if(!container) {
            return;
        }

        const {
            cmd = [],
            tty = false,
            user
        } = Array.isArray(options) ? {
            cmd: options,
            tty: _tty
        } as Params.Exec : options;

        const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: tty,
            User: user,
            Cmd: cmd,
            ConsoleSize: [
                process.stdout.rows,
                process.stdout.columns
            ]
        });

        const stream = await exec.start({
            hijack: true,
            stdin: tty,
            Tty: tty
        });

        if(tty) {
            const handleResize = async (): Promise<void> => {
                const [width, height] = process.stdout.getWindowSize();

                this.logService.debug("Exec resize", {
                    width,
                    height
                });

                await exec.resize({
                    w: width,
                    h: height
                });
            };

            process.on("SIGWINCH", handleResize);

            try {
                await this.modemService.attachStream(stream);
            }
            finally {
                process.off("SIGWINCH", handleResize);
            }
        }

        return stream;
    }
}
