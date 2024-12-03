import {
    Injectable,
    DockerService as CoreDockerService,
    DockerServiceParams as Params
} from "@wocker/core";
import Docker, {
    Container,
    Volume,
    VolumeCreateResponse
} from "dockerode";

import {followProgress} from "../utils";
import {FS, Logger} from "../makes";
import {LogService} from "./LogService";


@Injectable("DOCKER_SERVICE")
export class DockerService extends CoreDockerService {
    protected docker: Docker;

    public constructor(
        protected readonly logService: LogService
    ) {
        super();

        this.docker = new Docker({
            socketPath: "/var/run/docker.sock"
        });
    }

    public async createVolume(name: string): Promise<VolumeCreateResponse> {
        return await this.docker.createVolume({
            Name: name,
            Driver: "local"
        });
    }

    public async hasVolume(name: string): Promise<boolean> {
        const volume = await this.getVolume(name);

        try {
            await volume.inspect();

            return true;
        }
        catch(err) {
            return false;
        }
    }

    public async getVolume(name: string): Promise<Volume> {
        return this.docker.getVolume(name);
    }

    public async rmVolume(name: string): Promise<void> {
        const volume = await this.getVolume(name);

        await volume.remove();
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
            memory,
            memorySwap,
            ulimits,
            extraHosts,
            networkMode = "bridge",
            links = [],
            env = {} as any,
            volumes = [],
            ports = [],
            cmd = [],
            network: networkName = "workspace",
            aliases
        } = params;

        const network = this.docker.getNetwork(networkName);

        try {
            await network.inspect();
        }
        catch(err) {
            if(err.statusCode === 404) {
                await this.docker.createNetwork({
                    Name: networkName
                });
            }
        }

        await this.pullImage(image);

        return this.docker.createContainer({
            name,
            User: user,
            Image: image,
            Hostname: name,
            Domainname: name,
            Labels: {
                ...projectId ? {projectId} : {}
            },
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            OpenStdin: true,
            StdinOnce: false,
            Entrypoint: entrypoint,
            Tty: true,
            Cmd: cmd,
            Env: Object.keys(env).map((key) => {
                const value = env[key];

                return `${key}=${value}`;
            }),
            ExposedPorts: ports.reduce((res, value) => {
                const [,, containerPort, type = "tcp"] = /(\d+):(\d+)(?:\/(\w+))?/.exec(value) || [];

                if(containerPort) {
                    res[`${containerPort}/${type}`] = {};
                }

                return res;
            }, {}),
            HostConfig: {
                Memory: memory,
                MemorySwap: memorySwap,
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
                    const [, hostPort, containerPort, type = "tcp"] = /(\d+):(\d+)(?:\/(\w+))?/.exec(value) || [];

                    if(hostPort && containerPort) {
                        res[`${containerPort}/${type}`] = [
                            {HostPort: hostPort}
                        ];
                    }
                    else {
                        this.logService.warn(`Invalid port format for container "${name}": "${value}". Expected format: hostPort:containerPort[/protocol]`);
                    }

                    return res;
                }, {})
            },
            NetworkingConfig: {
                EndpointsConfig: networkMode === "host" ? {} : {
                    workspace: {
                        Links: links,
                        Aliases: aliases || (env.VIRTUAL_HOST ? env.VIRTUAL_HOST.split(",") : undefined)
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

    public async removeContainer(name: string): Promise<void> {
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

    public async buildImage(params: Params.BuildImage): Promise<void> {
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

    public async imageRm(tag: string, force: boolean = false): Promise<void> {
        const image = this.docker.getImage(tag);

        const exists = await this.imageExists(tag);

        if(!exists) {
            return;
        }

        await image.remove({
            force
        });
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
                ...reference
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

    public async attach(containerOrName: string|Container): Promise<NodeJS.ReadWriteStream> {
        let container: Container = typeof containerOrName === "string"
            ? await this.getContainer(containerOrName)
            : containerOrName;

        if(!container) {
            return;
        }

        const stream: NodeJS.ReadWriteStream = await container.attach({
            stream: true,
            hijack: true,
            stdin: true,
            stdout: true,
            stderr: true,
            logs: true,
            detachKeys: "ctrl-d"
        });

        await this.attachStream(stream);

        const handleResize = (): void => {
            const [width, height] = process.stdout.getWindowSize();

            container.resize({
                w: width,
                h: height
            });
        };

        process.stdout.on("resize", handleResize);

        handleResize();

        return stream;
    }

    public async attachStream(stream: NodeJS.ReadWriteStream): Promise<NodeJS.ReadWriteStream> {
        if(process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.pipe(stream);

        stream.setEncoding("utf8");
        stream.pipe(process.stdout);

        const onEnd = () => {
            process.stdin.pause();

            if(process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }

            process.stdin.unpipe(stream);

            stream.unpipe(process.stdout);
        };

        stream.on("end", onEnd);
        stream.on("error", onEnd);

        return stream;
    }

    public async exec(nameOrContainer: string|Container, options: Params.Exec|string[], _tty?: boolean) {
        const container: Container = typeof nameOrContainer === "string"
            ? await this.getContainer(nameOrContainer)
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
            AttachStderr: tty,
            Tty: tty,
            User: user,
            Cmd: cmd
        });

        const stream = await exec.start({
            hijack: true,
            stdin: tty,
            Tty: tty
        });

        if(tty) {
            await this.attachStream(stream);
            // stream.setEncoding("utf-8");
            //
            // process.stdin.resume();
            //
            // if(process.stdin.setRawMode) {
            //     process.stdin.setRawMode(true);
            // }
            //
            // process.stdin.setEncoding("utf-8");
            // process.stdin.pipe(stream);
            //
            // stream.pipe(process.stdout);
            //
            // stream.on("error", (err) => {
            //     Logger.error(err.message);
            // });
            //
            // stream.on("end", async () => {
            //     process.stdin.setRawMode(false);
            // });
            //
            // stream.on("end", async () => {
            //     process.exit();
            // });
        }

        // setTimeout(() => {
        //     Logger.info("Exit");
        //
        //     process.exit();
        // }, 4000);

        return stream;
    }

    public async logs(containerOrName: string|Container): Promise<NodeJS.ReadableStream> {
        const container: Container = typeof containerOrName === "string"
            ? await this.getContainer(containerOrName)
            : containerOrName;

        if(!container) {
            return;
        }

        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
            tail: 4
        });

        stream.on("data", (data: any) => {
            process.stdout.write(data);
        });

        stream.on("error", (data: any) => {
            process.stderr.write(data);
        });

        return stream;
    }
}
