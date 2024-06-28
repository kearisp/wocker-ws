import {
    Injectable,
    DockerServiceParams as Params
} from "@wocker/core";
import {demuxOutput} from "@wocker/utils";
import Docker, {Container} from "dockerode";

import {followProgress} from "../utils";
import {FS, Logger} from "../makes";
import {LogService} from "./LogService";


@Injectable("DOCKER_SERVICE")
export class DockerService {
    protected docker: Docker;

    public constructor(
        protected readonly logService: LogService
    ) {
        this.docker = new Docker({
            socketPath: "/var/run/docker.sock"
        });
    }

    public async createContainer(params: Params.CreateContainer): Promise<Container> {
        const {
            name,
            user,
            entrypoint,
            tty,
            image,
            projectId,
            restart,
            ulimits,
            extraHosts,
            networkMode,
            links = [],
            env = {},
            volumes = [],
            ports = [],
            cmd = []
        } = params;

        const network = this.docker.getNetwork("workspace");

        try {
            await network.inspect();
        }
        catch(err) {
            if(err.statusCode === 404) {
                await this.docker.createNetwork({
                    Name: "workspace"
                });
            }
        }

        await this.pullImage(image);

        return this.docker.createContainer({
            name,
            User: user,
            Image: image,
            Hostname: name,
            Labels: {
                ...projectId ? {projectId} : {}
            },
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            OpenStdin: true,
            StdinOnce: false,
            Entrypoint: entrypoint,
            // U
            Tty: tty,
            Cmd: cmd,
            Env: Object.keys(env).map((key) => {
                const value = env[key];

                return `${key}=${value}`;
            }),
            ExposedPorts: ports.reduce((res, value) => {
                const [,, containerPort] = /(\d+):(\d+)/.exec(value) || [];

                if(containerPort) {
                    res[`${containerPort}/tcp`] = {};
                }

                return res;
            }, {}),
            HostConfig: {
                NetworkMode: networkMode,
                ExtraHosts: extraHosts,
                Ulimits: ulimits ? Object.keys(ulimits).reduce((res, name) => {
                    return [
                        ...res,
                        {
                            Name: name,
                            Hard: ulimits[name].hard,
                            Soft: ulimits[name].soft
                        }
                    ];
                }, []) : [],
                ...restart ? {
                    RestartPolicy: {
                        Name: restart
                    }
                } : {},
                Binds: volumes,
                PortBindings: ports.reduce((res, value) => {
                    const [, hostPort, containerPort] = /(\d+):(\d+)/.exec(value) || [];

                    if(hostPort && containerPort) {
                        res[`${containerPort}/tcp`] = [
                            {HostPort: hostPort}
                        ];
                    }

                    return res;
                }, {}),
            },
            NetworkingConfig: {
                EndpointsConfig: networkMode === "host" ? {} : {
                    workspace: {
                        Links: links
                    }
                }
            }
        });
    }

    public async getContainer(name: string): Promise<Container|null> {
        const containers = await this.docker.listContainers({
            all: true,
            filters: {
                name: [name]
            }
        });

        const container = containers.find((container) => {
            return container.Names.indexOf("/" + name) >= 0;
        });

        if(container) {
            return this.docker.getContainer(container.Id);
        }

        return null;
    }

    public async removeContainer(name: string) {
        const container = await this.getContainer(name);

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
                Logger.error("DockerService.removeContainer", err.message);
            }
        }

        try {
            await container.remove();
        }
        catch(err) {
            Logger.error("DockerService.removeContainer: ", err.message);
        }
    }

    public async buildImage(params: Params.BuildImage) {
        const {
            tag,
            labels = {},
            buildArgs = {},
            context,
            src
        } = params;

        const files = await FS.readdirFiles(context, {
            recursive: true
        });

        const stream = await this.docker.buildImage({
            context,
            src: files
        }, {
            t: tag,
            labels,
            buildargs: Object.keys(buildArgs).reduce((res, key) => {
                res[key] = typeof buildArgs[key] !== "string"
                    ? (buildArgs[key] as any).toString()
                    : buildArgs[key];

                return res;
            }, {}),
            dockerfile: src
        });

        await followProgress(stream);
    }

    public async imageExists(tag: string): Promise<boolean> {
        const image = this.docker.getImage(tag);

        try {
            await image.inspect();

            return true;
        }
        catch(ignore) {
            return false;
        }
    }

    public async imageRm(tag: string): Promise<void> {
        const image = await this.docker.getImage(tag);

        if(!image) {
            return;
        }

        await image.remove();
    }

    public async imageLs(options?: Params.ImageList) {
        const {
            tag,
            reference,
            labels
        } = options || {};

        const filters: any = {};

        if(reference) {
            filters.reference = [
                ...filters.reference || [],
                reference
            ];
        }

        if(tag) {
            filters.reference = [
                ...filters.reference || [],
                tag
            ];
        }

        if(labels) {
            filters.label = [];

            for(const i in labels) {
                filters.label.push(`${i}=${labels[i]}`);
            }
        }

        return this.docker.listImages({
            filters: JSON.stringify(filters)
        });
    }

    public async pullImage(tag: string): Promise<void> {
        const exists = await this.imageExists(tag);

        if(exists) {
            return;
        }

        const stream = await this.docker.pull(tag);

        await followProgress(stream);
    }

    public async attach(name: string) {
        const container = await this.getContainer(name);

        if(!container) {
            return;
        }

        const stream = await container.attach({
            logs: true,
            stream: true,
            hijack: true,
            stdin: true,
            stdout: true,
            stderr: true,
            detachKeys: "ctrl-c"
        });

        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.setRawMode(true);
        process.stdin.pipe(stream);

        process.stdin.on("data", (data) => {
            if(data.toString() === "\u0003") {
                process.stdin.setRawMode(false);
            }
        });

        stream.on("data", (data) => {
            process.stdout.write(demuxOutput(data));
        });

        stream.on("end", async () => {
            process.exit();
        });

        process.stdout.on("resize", () => {
            const [width, height] = process.stdout.getWindowSize();

            container.resize({
                w: width,
                h: height
            });
        });

        const [width, height] = process.stdout.getWindowSize();

        await container.resize({
            w: width,
            h: height
        });
    }

    public async logs(name: string): Promise<void> {
        const container = await this.getContainer(name);

        if(!container) {
            return;
        }

        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true
        });

        stream.on("data", (data) => {
            process.stdout.write(demuxOutput(data));
        });
    }

    public async attachStream(stream: NodeJS.ReadWriteStream) {
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.pipe(stream);

        if(process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        stream.setEncoding("utf8");
        stream.pipe(process.stdout);

        const end = () => {
            process.stdin.pause();
            process.stdin.unpipe(stream);

            if(process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }

            stream.unpipe(process.stdout);
        };

        await new Promise((resolve, reject) => {
            stream.on("end", end);
            stream.on("error", end);
            stream.on("end", resolve);
            stream.on("error", reject);
        });
    }

    public async exec(name: string, args?: string[], tty = false) {
        const container = await this.getContainer(name);

        if(!container) {
            return;
        }

        const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: tty,
            Tty: tty,
            Cmd: args || []
        });

        const stream = await exec.start({
            hijack: true,
            stdin: tty,
            Tty: tty
        });

        if(tty) {
            stream.setEncoding("utf-8");

            process.stdin.resume();

            if(process.stdin.setRawMode) {
                process.stdin.setRawMode(true);
            }

            process.stdin.setEncoding("utf-8");
            process.stdin.pipe(stream);

            stream.pipe(process.stdout);

            stream.on("error", (err) => {
                Logger.error(err.message);
            });

            stream.on("end", async () => {
                process.stdin.setRawMode(false);
            });

            stream.on("end", async () => {
                process.exit();
            });
        }

        // setTimeout(() => {
        //     Logger.info("Exit");
        //
        //     process.exit();
        // }, 4000);

        return stream;
    }
}
