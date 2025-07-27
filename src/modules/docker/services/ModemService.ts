import {
    Injectable,
    ModemService as CoreModemService,
    LogService
} from "@wocker/core";
import type Modem from "docker-modem";
import type Docker from "dockerode";
import {formatSizeUnits} from "../utils/formatSizeUnits";
import {ProtoService} from "./ProtoService";


@Injectable("DOCKER_MODEM_SERVICE")
export class ModemService extends CoreModemService {
    protected _modem?: Modem;
    protected _docker?: Docker;
    protected record?: boolean = true;

    public constructor(
        protected readonly protoService: ProtoService,
        protected readonly logService: LogService
    ) {
        super();
    }

    public get modem(): Modem {
        if(!this._modem) {
            const Modem = require("docker-modem");

            this._modem = new Modem({
                socketPath: "/var/run/docker.sock"
            });
        }

        return this._modem!;
    }

    public get docker(): Docker {
        if(!this._docker) {
            const Docker = require("dockerode");

            this._docker = new Docker({
                modem: this.modem
            });
        }

        return this._docker!;
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

        try {
            await new Promise<void>((resolve, reject) => {
                stream.on("end", resolve);
                stream.on("error", reject);
            });
        }
        finally {
            process.stdin.pause();

            if(process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }

            process.stdin.unpipe(stream);

            stream.unpipe(process.stdout);
        }

        return stream;
    }

    public async followProgress(stream: NodeJS.ReadableStream): Promise<void> {
        let isEnded = false,
            line = 0;

        const mapLines: ({
            [id: string]: number;
        }) = {};

        return new Promise<void>((resolve, reject) => {
            const handleEnd = () => {
                if(!isEnded) {
                    resolve();
                }

                isEnded = true;
            };

            stream.on("data", (chunk: Buffer) => {
                const text = chunk.toString().replace(/}\s*\{/g, "},{"),
                      items: any[] = JSON.parse(`[${text}]`);

                for(const item of items) {
                    if(item.id === "moby.buildkit.trace") {
                        const StatusResponse = this.protoService.lookupType("moby.buildkit.v1.StatusResponse");

                        const buffer = Buffer.from(item.aux, "base64");
                        const decoded = StatusResponse.decode(buffer);

                        const obj = StatusResponse.toObject(decoded, {
                            enums: String,
                            longs: String,
                            bytes: String,
                            defaults: true
                        });

                        console.dir(obj, {
                            depth: null
                        });
                    }
                    else if(item.id === "moby.image.id") {
                        console.dir(item, {
                            depth: null
                        });
                    }
                    else if(item.stream) {
                        process.stdout.write(`${item.stream}`);
                        line += item.stream.split("\n").length - 1;
                    }
                    else if(item.id) {
                        const {
                            id,
                            status,
                            processDetail: {
                                current,
                                total
                            } = {}
                        } = item;

                        if(typeof mapLines[id] === "undefined") {
                            mapLines[id] = line;
                        }

                        const targetLine = typeof mapLines[id] !== "undefined"
                            ? mapLines[id]
                            : line;
                        const dy = line - targetLine;

                        if(dy > 0) {
                            process.stdout.write("\x1b[s");
                            process.stdout.write(`\x1b[${dy}A`);
                        }

                        process.stdout.write("\x1b[2K");

                        let str = `${id}: ${status}\n`;

                        if(status === "Downloading") {
                            const width = process.stdout.columns;

                            const sizeWidth = 19,
                                totalWidth = width - id.length - status.length - sizeWidth - 7,
                                currentWidth = Math.floor(totalWidth * (current / total)),
                                formatSize = `${formatSizeUnits(current)}/${formatSizeUnits(total)}`;

                            str = `${id}: ${status} [${"█".repeat(currentWidth)}${"░".repeat(totalWidth - currentWidth)}] ${formatSize}\n`;
                        }

                        process.stdout.write(str);

                        if(dy > 0) {
                            process.stdout.write("\x1b[u");
                        }
                        else {
                            line++;
                        }
                    }
                    else if(typeof item.aux === "object") {
                        const str = `auxID: ${item.aux.ID}`;

                        process.stdout.write(`${str}\n`);

                        line += Math.ceil(str.length / process.stdout.columns);
                    }
                    else if(item.status) {
                        process.stdout.write(`${item.status}\n`);

                        line += Math.ceil(item.status.length / process.stdout.columns);
                    }
                    else {
                        console.info("Unexpected data", item);
                    }
                }
            });
            stream.on("end", handleEnd);
            stream.on("close", handleEnd);
            stream.on("error", (err: Error) => {
                reject(err);
            });
        });
    }
}
