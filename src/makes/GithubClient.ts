import axios, {AxiosInstance} from "axios";
import type {Entry} from "unzipper";
import {FileSystem} from "@wocker/core";


type RepositoryInfo = {
    default_branch: string;
};

export class GithubClient {
    public constructor(
        public owner: string,
        public repository: string
    ) {}

    public get axios(): AxiosInstance {
        return axios.create({
            headers: {
                "User-Agent": "Wocker"
            },
        });
    }

    public async getInfo(): Promise<RepositoryInfo> {
        const response = await this.axios.get<RepositoryInfo>(`https://api.github.com/repos/${this.owner}/${this.repository}`, {
            headers: {
                "Accept": "application/vnd.github+json"
            }
        });

        return response.data;
    }

    public async getFile(branch: string, path: string) {
        const response = await this.axios.get(`https://raw.githubusercontent.com/${this.owner}/${this.repository}/${branch}/${path}`, {
            headers: {
                "Accept": "application/vnd.github+json"
            }
        });

        return response.data;
    }

    public async download(branch: string, dirPath: string): Promise<void> {
        const res = await this.axios.get(`https://github.com/${this.owner}/${this.repository}/archive/refs/heads/${branch}.zip`, {
            responseType: "stream"
        });

        const fs = new FileSystem(dirPath);

        if(!fs.exists()) {
            fs.mkdir("", {
                recursive: true
            });
        }

        return new Promise((resolve, reject) => {
            const {Parse} = require("unzipper"),
                  pipe = res.data.pipe(Parse());

            pipe.on("entry", (entry: Entry): void => {
                const path = entry.path.replace(/^[^\/]+\//, "");

                if(entry.type === "File") {
                    entry.pipe(
                        fs.createWriteStream(path)
                    );
                }
                else if(entry.type === "Directory") {
                    fs.mkdir(path, {
                        recursive: true
                    });
                }
            });

            pipe.on("end", () => resolve());
            pipe.on("error", reject);
        });
    }
}
