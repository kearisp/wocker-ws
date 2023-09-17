import Dockerode from "dockerode";
import {imageBuild} from "src/utils/image-build";
import {followProgress} from "src/utils/followProgress";

import {FS} from "./FS";
import {Logger} from "./Logger";


type ContainerRunOptions = {
    name: string;
    image: string;
    restart?: "always";
    projectId?: string;
    tty?: boolean;
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

type ImageBuildOptions = {
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

const docker = new Dockerode({
    socketPath: "/var/run/docker.sock"
});

class Docker {
    static docker = docker;

    static async exec(name: string, args: string[], tty = true) {
        const container = docker.getContainer(name);

        const exec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: tty,
            Tty: tty,
            Cmd: args
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

    static async getImage(name: string) {
        // let images = await exec(
        //     "docker image ls" +
        //     "   --filter=reference=\"" + name + "\""
        // ).then((res:any) => {
        //     let pos = {
        //         0: "repository",
        //         1: "tag",
        //         2: "imageId",
        //         3: "created",
        //         4: "size"
        //     };
        //
        //     res = res.stdout.split("\n").filter((line) => {
        //         return line.split(new RegExp("\\s\\s+")).filter((item) => {
        //             return item !== "";
        //         }).length > 0;
        //     }).map((line, index) => {
        //         if(index === 0) {
        //             return null;
        //         }
        //
        //         let data = line.split(new RegExp("\\s\\s+"));
        //
        //         let row = {};
        //
        //         for(let i in data) {
        //             let name = pos[i];
        //
        //             row[name] = data[i];
        //         }
        //
        //         return row;
        //     }).filter((line) => {
        //         if(!line) {
        //             return false;
        //         }
        //
        //         return true;
        //     });
        //
        //     return res;
        // }).catch((err:any) => {
        //     console.error(err);
        //
        //     return [];
        // });
        //
        // return lodash.get(images, "[0]", null);

        return docker.getImage(name);
    }

    static async getContainer(name) {
        const containers = await docker.listContainers({
            all: true,
            filters: {
                name: [name]
            }
        });

        const container = containers.find((container) => {
            return container.Names.indexOf("/" + name) >= 0;
        });

        if(container) {
            return docker.getContainer(container.Id);
        }

        return null;
    }

    static async removeContainer(name: string) {
        const container = await Docker.getContainer(name);

        if(!container) {
            return;
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "running") {
            try {
                await container.stop();
            }
            catch(err) {
                Logger.error("Docker.removeContainer: ", err.message);
            }
        }

        try {
            await container.remove();
        }
        catch(err) {
            Logger.error("Docker.removeContainer: ", err.message);
        }
    }

    static async getContainerList(options?: {name?: string; projectId?: string;}) {
        const {
            name,
            projectId
        } = options || {};

        const filters: any = {};

        if(name) {
            filters.name = [`/${name}`];
        }

        if(projectId) {
            if(!filters.label) {
                filters.label = [];
            }

            filters.label.push(`projectId=${projectId}`);
        }

        return docker.listContainers({
            all: true,
            filters: JSON.stringify(filters)
        });
    }

    static async attach(name: string) {
        const container = await Docker.getContainer(name);

        const stream = await container.attach({
            logs: true,
            stream: true,
            hijack: true,
            stdin: true,
            stdout: true,
            stderr: true
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

        stream.setEncoding("utf8");
        stream.pipe(process.stdout);

        const [width, height] = process.stdout.getWindowSize();

        await container.resize({
            w: width,
            h: height
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
    }

    static async attachStream(stream: NodeJS.ReadWriteStream) {
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

    static async imageExists(tag: string): Promise<boolean> {
        const image = docker.getImage(tag);

        try {
            await image.inspect();

            return true;
        }
        catch(ignore) {
            return false;
        }
    }

    static async imageLs(options?: {tag?: string; reference?: string; labels?: {[key: string]: string;}}) {
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

        return docker.listImages({
            filters: JSON.stringify(filters)
        });
    }

    static async imageBuild(options: ImageBuildOptions) {
        // await docker.buildImage({
        //     context:
        // });

        await imageBuild(options);
    }

    static async imageBuild2(options: ImageBuildOptions): Promise<NodeJS.ReadableStream> {
        const {
            tag,
            labels = {},
            buildArgs = {},
            context,
            src
        } = options;

        const files = await FS.readdirFiles(context, {
            recursive: true
        });

        const stream = await docker.buildImage({
            context,
            src: files
        }, {
            t: tag,
            labels,
            dockerfile: src,
            buildargs: buildArgs
        });

        return stream;
    }

    static async imageRm(name: string) {
        const image = await docker.getImage(name);

        if(!image) {
            return;
        }

        await image.remove();
    }

    static async pullImage(tag: string) {
        const isExists = await this.imageExists(tag);

        if(isExists) {
            return;
        }

        const stream = await docker.pull(tag, {});

        await followProgress(stream);
    }

    static async createContainer(options: ContainerRunOptions) {
        const {
            name,
            tty,
            image,
            projectId,
            restart,
            extraHosts,
            networkMode,
            links = [],
            env = {},
            volumes = [],
            ports = [],
            cmd = []
        } = options;

        const network = docker.getNetwork("workspace");

        try {
            await network.inspect();
        }
        catch(err) {
            if(err.statusCode === 404) {
                await docker.createNetwork({
                    Name: "workspace"
                });
            }
        }

        await this.pullImage(image);

        return await docker.createContainer({
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
                }, {})
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

    static async containerRun(options: ContainerRunOptions, attach = false) {
        const container = await Docker.createContainer(options);

        if(attach) {
            const stdout = await container.attach({
                // logs: true,
                stream: true,
                stdin: true,
                stdout: true,
                stderr: true
            });

            stdout.pipe(process.stdout);
        }

        await container.start();

        return container;
    }
}


export {Docker};
