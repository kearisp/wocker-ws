import {FS as CoreFS} from "@wocker/core";
import * as fs from "fs";
import {
    Stats,
    BigIntStats,
    PathLike,
    PathOrFileDescriptor,
    WriteFileOptions,
    Dirent,
    MakeDirectoryOptions
} from "fs";
import * as Path from "path";
import {PassThrough} from "readable-stream";


type ReaddirFilesOptions = {
    recursive?: boolean;
};

/**
 * @deprecated
 */
export class FS extends CoreFS {
    public static async access(path: PathLike): Promise<any> {
        return new Promise((resolve, reject) => {
            fs.access(path, (err) => {
                if(!err) {
                    resolve(null);
                }
                else {
                    reject(err);
                }
            });
        });
    }

    public static existsSync(path: PathLike) {
        return fs.existsSync(path);
    }

    public static async mkdir(dirPath: string, options: MakeDirectoryOptions = {}): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.mkdir(dirPath, options, (err) => {
                if(!err) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }

    public static mkdirSync(path: string, options?: MakeDirectoryOptions) {
        return fs.mkdirSync(path, options);
    }

    public static async readdirFiles(path: string, options?: ReaddirFilesOptions): Promise<string[]> {
        const {
            recursive = false
        } = options || {};

        if(recursive) {
            const names = await FS.readdir(path);
            let res: string[] = [];

            for(const name of names) {
                const filePath = Path.join(path, name);

                let sub = [
                    name
                ];

                const stats = await FS.stat(filePath);

                if(stats.isDirectory()) {
                    sub = (await FS.readdirFiles(filePath, {recursive: true})).map((subName) => {
                        return Path.join(name, subName);
                    });
                }

                res = [
                    ...res,
                    ...sub
                ];
            }

            return res;
        }

        return new Promise<string[]>((resolve, reject) => {
            fs.readdir(path, {
                withFileTypes: true
            } as any, (err, files: Dirent[]) => {
                if(err) {
                    reject(err);
                    return;
                }

                const names = files.filter((dirent: Dirent) => {
                    return dirent.isFile();
                }).map((dirent: Dirent) => {
                    return dirent.name;
                });

                resolve(names);
            });
        });
    }

    public static async appendFile(path: PathOrFileDescriptor, data: any, options?: WriteFileOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.appendFile(path, data, options, (error: any) => {
                if(error) {
                    reject(error);
                }
                else {
                    resolve(undefined);
                }
            });
        });
    }

    public static appendFileSync(path: PathOrFileDescriptor, data: any, options?: WriteFileOptions) {
        return fs.appendFileSync(path, data, options);
    }

    public static async readBytes(filePath: PathLike, position: number|bigint = 0, size?: number|bigint): Promise<Buffer> {
        if(position < 0 && typeof size === "undefined") {
            const stats = await FS.stat(filePath);

            size = BigInt(position) * -1n;
            position = BigInt(stats.size) - size;

            if(position < 0n) {
                position = 0;
            }
        }
        else if(typeof size === "undefined") {
            const stats = await FS.stat(filePath);

            if(typeof stats.size !== "bigint" && typeof position !== "bigint") {
                size = stats.size - position;
            }
            else {
                size = BigInt(stats.size) - BigInt(position);
            }
        }

        if(size < 0n) {
            // throw Error(`Buffer size ${size}`);

            return Buffer.alloc(0);
        }

        const buffer = Buffer.alloc(Number(size));

        return new Promise((resolve, reject) => {
            fs.open(filePath, (err, file) => {
                if(err) {
                    reject(err);
                    return;
                }

                fs.read(file, buffer, 0, buffer.length, position, (err, _, buffer) => {
                    if(err) {
                        reject(err);
                        return;
                    }

                    resolve(buffer);
                });
            });
        });
    }

    public static readFileSync(filePath: PathLike) {
        return fs.readFileSync(filePath);
    }

    public static writeFileSync(path: PathLike, data: any, options?: WriteFileOptions) {
        return fs.writeFileSync(path, data, options);
    }

    public static createWriteStream(path: PathLike) {
        return fs.createWriteStream(path);
    }

    public static async unlink(filePath: PathLike): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if(!err) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }

    public static watch(filename: PathLike, options?: any) {
        return fs.watch(filename, options);
    }

    public static stat(filename: PathLike, options?: Parameters<typeof fs.stat>[1]): Promise<Stats|BigIntStats> {
        return new Promise((resolve, reject) => {
            fs.stat(filename, options, (err, stats) => {
                if(err) {
                    reject(err);
                }
                else {
                    resolve(stats);
                }
            });
        });
    }

    public static createReadStream(path: PathLike, options?: Parameters<typeof fs.createReadStream>[1]) {
        return fs.createReadStream(path, options);
    }

    public static createReadLinesStream(path: PathLike, count?: number) {
        const write = new PassThrough();

        (async () => {
            if(typeof count === "undefined" || count > 0) {
                const stats = await FS.stat(path);
                const resLines: string[] = [""];

                let position = 0n;

                while(position < stats.size) {
                    let size = BigInt(count ? 64 * count : 255);

                    if(position + size > stats.size) {
                        size = BigInt(stats.size) - position;
                    }

                    const buffer = await FS.readBytes(path, position, size);
                    const lines = buffer.toString("utf-8").split("\n");

                    position += size;

                    for(let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        if(i === 0) {
                            resLines[resLines.length - 1] = (resLines[resLines.length - 1] || "") + line;
                        }
                        else {
                            resLines.push(line);
                        }
                    }

                    if(resLines.length > count + 1) {
                        break;
                    }
                }

                for(let i = 0; i < (count || resLines.length); i++) {
                    write.write(resLines[i]);
                }
            }
            else if(count < 0) {
                const stats = await FS.stat(path);
                const resLines = [""];

                let position = BigInt(stats.size);

                while(position > 0n) {
                    // let size = BigInt(64 * count * -1);
                    let size = BigInt(2 * count * -1);
                    position -= size;

                    if(position < 0) {
                        size = position + size;
                        position = 0n;
                    }

                    const buffer = await FS.readBytes(path, position, size);
                    const lines = buffer.toString("utf-8").split("\n").reverse();

                    for(let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        if(i === 0) {
                            resLines[0] = line + (resLines[0] || "");
                        }
                        else {
                            resLines.unshift(line);
                        }
                    }

                    if(resLines.length > count * -1 + 1) {
                        break;
                    }
                }

                const lines = resLines.slice(count - 1);

                for(let i = 0; i < lines.length; i++) {
                    write.write(lines[i]);
                }

                write.end();
            }
        })();

        return write;
    }

    public static async copyFile(src: PathLike, dest: PathLike) {
        new Promise((resolve, reject) => {
            fs.copyFile(src, dest, (err) => {
                if(!err) {
                    resolve(undefined);
                }
                else {
                    reject(err);
                }
            });
        });
    }
}
