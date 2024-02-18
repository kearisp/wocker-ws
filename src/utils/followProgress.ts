import {LineConvertStream} from "../makes/LineConvertStream";
import {formatSizeUnits} from "./format-size-units";
import {Logger} from "../makes";


type Data = {
    id?: string;
    stream?: string;
    status?: string;
    progress?: string;
    progressDetail?: {
        current: number;
        total: number;
    };
    aux?: {
        ID: string;
    };
    error?: string;
    errorDetail?: {
        code: number;
        message: string;
    };
};


export const followProgress = async (stream: NodeJS.ReadableStream) => {
    const lineStream = new LineConvertStream(stream);

    let line = 0;

    const mapLines: ({
        [id: string]: number;
    }) = {};

    lineStream.on("data", (chunk) => {
        const data: Data = JSON.parse(chunk.toString());

        const {
            stream,
            id,
            status,
            progressDetail: {
                current,
                total
            } = {},
            aux
        } = data;

        if(stream) {
            process.stdout.write(`${stream}`);

            line += stream.split("\n").length - 1;
            // line += Math.ceil(stream.length / process.stdout.columns);
        }
        else if(id) {
            if(typeof mapLines[id] === "undefined") {
                mapLines[id] = line;
            }

            const targetLine = typeof mapLines[id] !== "undefined" ? mapLines[id] : line;
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
        else if(status) {
            process.stdout.write(`${status}\n`);

            line += Math.ceil(status.length / process.stdout.columns);
        }
        else if(aux) {
            const str = `auxID: ${aux.ID}`;

            process.stdout.write(`${str}\n`);

            line += Math.ceil(str.length / process.stdout.columns);
        }
        else {
            Logger.warn("followProgress: unexpected data", data);
        }
    });

    return new Promise((resolve, reject) => {
        let isEnded = false;

        const handleEnd = () => {
            if(!isEnded) {
                resolve(null);
            }

            isEnded = true;
        };

        lineStream.on("end", handleEnd);
        lineStream.on("close", handleEnd);
        lineStream.on("error", reject);
    });
};
