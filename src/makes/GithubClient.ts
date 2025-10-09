import axios, {AxiosInstance} from "axios";
import type {Entry} from "unzipper";
import {FileSystem} from "@wocker/core";


type RepositoryInfo = {
    default_branch: string;
};

export type GithubTag = {
    name: string;
    zipball_url: string;
    tarball_url: string;
    commit: {
        sha: string;
        url: string;
    };
    node_id: string;
};

export type GithubBranch = {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    protected: boolean;
};

export class GithubClient {
    public constructor(
        public readonly owner: string,
        public readonly repository: string
    ) {}

    public get axios(): AxiosInstance {
        return axios.create({
            headers: {
                "User-Agent": "Wocker"
            }
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

    public async getBranches(): Promise<GithubBranch[]>{
        const response = await this.axios
            .get<GithubBranch[]>(`https://api.github.com/repos/${this.owner}/${this.repository}/branches`);

        return response.data;
    }

    public async getTags(): Promise<GithubTag[]> {
        const response = await this.axios
            .get<GithubTag[]>(`https://api.github.com/repos/${this.owner}/${this.repository}/tags`);

        return response.data;
    }

    public async getFile(ref: string, path: string): Promise<any> {
        const res = await this.axios
            .get(`https://raw.githubusercontent.com/${this.owner}/${this.repository}/${ref}/${path}`, {
                headers: {
                    "Accept": "application/vnd.github+json"
                }
            });

        return res.data;
    }

    public async downloadZipByUrl(url: string, dirPath: string): Promise<void> {
        const res = await this.axios.get(url, {
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

    public async download(branch: string, dirPath: string): Promise<void> {
        return this.downloadZipByUrl(
            `https://api.github.com/repos/${this.owner}/${this.repository}/zipball/${branch}`,
            dirPath
        );
    }
}
