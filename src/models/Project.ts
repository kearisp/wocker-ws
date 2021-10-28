import * as Path from "path";

import {EnvConfig} from "src/types";
import {FS} from "src/makes";
import {volumeParse, volumeFormat, setConfig, getConfig} from "src/utils";
import {MAP_PATH, DATA_DIR} from "src/env";


type SearchOptions = {
    id: string;
    name: string;
    src: string;
};

export class Project {
    public id: string;
    public type: string;
    public name: string;
    public path: string;
    public dockerfile?: string;
    public imageName?: string;
    public buildArgs?: EnvConfig;
    public env?: EnvConfig;
    public domains?: string[];
    public volumes?: string[];
    public meta?: {
        [key: string]: string;
    };

    public setEnv(name: string, value: string|boolean) {
        this.env = {
            ...this.env || {},
            [name]: typeof value === "boolean"
                ? (value ? "true" : "false")
                : value
        };
    }

    public getEnv(name: string, defaultValue?: string): string {
        const {
            [name]: value = defaultValue
        } = this.env || {};

        return value;
    }

    public unsetEnv(name: string) {
        if(this.env && this.env[name]) {
            delete this.env[name];
        }
    }

    public getMeta(name: string, defaultValue?: string): string|undefined {
        const {
            [name]: value = defaultValue
        } = this.meta || {};

        return value;
    }

    public setMeta(name: string, value: string) {
        if(!this.meta) {
            this.meta = {};
        }

        this.meta[name] = value;
    }

    public volumeMount(...volumes: string[]) {
        if(volumes.length === 0) {
            return;
        }

        const [volume, ...restVolumes] = volumes;

        const {destination} = volumeParse(volume);

        this.volumes = [
            ...(this.volumes || []).filter((v) => {
                return v !== this.getVolumeByDestination(destination);
            }),
            volume
        ];

        this.volumeMount(...restVolumes);
    }

    public getVolumeBySource(source: string): string|undefined {
        return (this.volumes || []).find((volume: string) => {
            return volumeParse(volume).source === source;
        });
    }

    public getVolumeByDestination(destination: string): string|undefined {
        return (this.volumes || []).find((volume: string) => {
            return volumeParse(volume).destination === destination;
        });
    }

    public volumeUnmount(...volumes: string[]) {
        this.volumes = this.volumes.filter((mounted) => {
            return !volumes.includes(mounted);
        });
    }

    static async get(id: string) {
        //
    }

    public async save() {
        if(!this.name) {
            throw new Error("Project should has a name");
        }

        if(!this.path) {
            throw new Error("Project should has a path");
        }

        if(!this.id) {
            this.id = this.name;
        }

        const projectDirPath = Path.join(DATA_DIR, "projects", this.name);

        if(!FS.existsSync(projectDirPath)) {
            await FS.mkdir(projectDirPath);
        }

        const configPath = Path.join(DATA_DIR, "projects", this.id, "config.json");

        await FS.writeJSON(configPath, this);

        const config = await getConfig();

        await setConfig({
            ...config,
            projects: [
                ...(config.projects || []).filter((project) => {
                    return project.id !== this.id;
                }).filter((project) => {
                    return project.src !== this.path;
                }),
                {
                    id: this.id,
                    src: this.path
                }
            ]
        });
    }

    static fromObject(data: any) {
        const project = new Project();

        for(const i in data) {
            project[i] = data[i];
        }

        return project;
    }

    static async search(params: Partial<SearchOptions> = {}): Promise<Project[]> {
        const {
            id,
            name,
            src
        } = params;

        const map = await FS.readJSON(MAP_PATH);

        const mapProjects = map.projects.filter((config) => {
            if(id) {
                return config.id === id;
            }

            return true;
        }).filter((config) => {
            if(src) {
                return config.src === src;
            }

            return true;
        });

        const projects: Project[] = [];

        for(const i in mapProjects) {
            const projectConfig = await FS.readJSON(Path.join(DATA_DIR, "projects", mapProjects[i].id, "config.json"));

            const project = Project.fromObject({
                ...projectConfig,
                id: projectConfig.id
            });

            if(name && project.name !== name) {
                continue;
            }

            projects.push(project);
        }

        return projects;
    }

    static async searchOne(params: Partial<SearchOptions> = {}): Promise<Project|null>  {
        const [project] = await Project.search(params);

        return project || null;
    }
}

export const PROJECT_TYPE_DOCKERFILE = "dockerfile";
export const PROJECT_TYPE_IMAGE = "image";
