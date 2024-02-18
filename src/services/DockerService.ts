import Docker, {Container} from "dockerode";

import {followProgress} from "../utils";
import {DI, FS, Logger} from "../makes";


namespace Params {
    export type CreateContainer = {
        name: string;
        image: string;
        restart?: "always";
        projectId?: string;
        tty?: boolean;
        ulimits?: {
            [key: string]: {
                hard?: number;
                soft?: number;
            };
        };
        links?: string[];
        env?: {
            [key: string]: string;
        };
        networkMode?: string;
        extraHosts?: any;
        volumes?: string[];
        ports?: string[];
        cmd?: string[];
    };

    export type BuildImage = {
        tag: string;
        buildArgs?: {
            [key: string]: string;
        };
        labels?: {
            [key: string]: string;
        };
        context: string;
        src: string;
    };
}

class DockerService {
    protected docker: Docker;

    public constructor(di: DI) {
        this.docker = new Docker({
            socketPath: "/var/run/docker.sock"
        });
    }

    public async createContainer(params: Params.CreateContainer): Promise<Container> {
        const {
            name,
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
                    ? buildArgs[key].toString()
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

    public async pullImage(tag: string): Promise<void> {
        const exists = await this.imageExists(tag);

        if(exists) {
            return;
        }

        const stream = await this.docker.pull(tag);

        await followProgress(stream);
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
}


export {DockerService};
