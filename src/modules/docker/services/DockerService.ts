import {
    Injectable,
    DockerService as CoreDockerService,
    DockerServiceParams as Params,
    LogService
} from "@wocker/core";
import type Docker from "dockerode";
import type {Container, Volume, VolumeCreateResponse} from "dockerode";
import {ContainerService} from "./ContainerService";
import {ModemService} from "./ModemService";
import {ImageService} from "./ImageService";


@Injectable("DOCKER_SERVICE")
export class DockerService extends CoreDockerService {
    public constructor(
        protected readonly modemService: ModemService,
        protected readonly containerService: ContainerService,
        protected readonly imageService: ImageService,
        protected readonly logService: LogService
    ) {
        super();
    }

    public get docker(): Docker {
        return this.modemService.docker;
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
                    [networkName]: {
                        Links: links,
                        Aliases: aliases || (env.VIRTUAL_HOST ? env.VIRTUAL_HOST.split(",") : undefined)
                    }
                }
            }
        });
    }

    public async getContainer(name: string): Promise<Container|null> {
        return this.containerService.get(name);
    }

    public async removeContainer(name: string): Promise<void> {
        await this.containerService.rm(name);
    }

    public async buildImage(params: Params.BuildImage): Promise<void> {
        await this.imageService.build(params);
    }

    public async imageExists(tag: string): Promise<boolean> {
        return this.imageService.exists(tag);
    }

    public async imageRm(tag: string, force: boolean = false): Promise<void> {
        await this.imageService.rm(tag, force);
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
        await this.imageService.pull(tag);
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
        return this.modemService.attachStream(stream);
    }

    public async exec(nameOrContainer: string|Container, options: Params.Exec|string[], _tty?: boolean) {
        return await this.containerService.exec(nameOrContainer, options, _tty);
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

    public async followProgress(stream: NodeJS.ReadableStream): Promise<void> {
        await this.modemService.followProgress(stream);
    }
}
