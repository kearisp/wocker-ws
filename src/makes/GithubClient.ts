import type {Entry} from "unzipper";
import {FileSystem} from "@wocker/core";
import {Http} from "@wocker/utils";


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

    public get client() {
        return Http.base("https://api.github.com", {
            headers: {
                "User-Agent": "Wocker"
            }
        })
    }

    public get contentClient() {
        return Http.base("https://raw.githubusercontent.com", {
            headers: {
                "User-Agent": "Wocker"
            }
        })
    }

    public async getInfo(): Promise<RepositoryInfo> {
        return this.contentClient.get(`/repos/${this.owner}/${this.repository}`)
            .withHeader("Accept", "application/vnd.github+json")
            .expectStatus(200)
            .json();
    }

    public async getBranches(): Promise<GithubBranch[]> {
        return this.client
            .get(`/repos/${this.owner}/${this.repository}/branches`)
            .expectStatus(200)
            .json();
    }

    public async getTags(): Promise<GithubTag[]> {
        return this.client
            .get(`/repos/${this.owner}/${this.repository}/tags`)
            .expectStatus(200)
            .json();
    }

    public async getFile(ref: string, path: string): Promise<any> {
        return this.contentClient
            .get(`/${this.owner}/${this.repository}/${ref}/${path}`)
            .withHeader("Accept", "application/vnd.github+json")
            .expectStatus(200)
            .json();
    }

    public async downloadZipByUrl(url: string, dirPath: string): Promise<void> {
        const res = await Http.base(url).expectStatus(200).send();
        const fs = new FileSystem(dirPath);

        if(!fs.exists()) {
            fs.mkdir("", {
                recursive: true
            });
        }

        return new Promise((resolve, reject) => {
            const {Parse} = require("unzipper"),
                  pipe = res.pipe(Parse());

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
