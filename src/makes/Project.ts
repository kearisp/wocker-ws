import "reflect-metadata";

import {DI} from "../makes/DI";
import {ProjectService} from "../services/ProjectService";
import {volumeParse} from "../utils/volumeParse";
import {EnvConfig} from "../types";


let projectService: ProjectService|undefined;

type SearchOptions = {
    id: string;
    name: string;
    path: string;
};

class Project {
    public id: string;
    public name: string
    public type: string;
    public path: string;
    public preset?: string;
    public imageName?: string;
    public dockerfile?: string;
    public scripts?: string[];
    public buildArgs?: EnvConfig;
    public env: EnvConfig;
    public ports?: string[];
    public volumes?: string[];
    public metadata?: EnvConfig;

    public constructor(data: any) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.path = data.path;
        this.preset = data.preset;
        this.dockerfile = data.dockerfile;
        this.imageName = data.imageName;
        this.scripts = data.scripts;
        this.buildArgs = data.buildArgs;
        this.env = data.env || {};
        this.ports = data.ports;
        this.volumes = data.volumes;
        this.metadata = data.metadata;
    }

    public get containerName() {
        return `${this.name}.workspace`;
    }

    public hasEnv(name: string): boolean {
        if(!this.env) {
            return false;
        }

        return this.env.hasOwnProperty(name);
    }

    public getEnv(name: string, defaultValue?: string): string|undefined {
        const {
            [name]: value = defaultValue
        } = this.env;

        return value;
    }

    public setEnv(name: string, value: string|boolean): void {
        this.env = {
            ...this.env,
            [name]: typeof value === "boolean"
                ? (value ? "true" : "false")
                : value
        };
    }

    public unsetEnv(name: string): void {
        if(name in this.env) {
            delete this.env[name];
        }
    }

    public hasMeta(name: string): boolean {
        return !!this.metadata && this.metadata.hasOwnProperty(name);
    }

    public getMeta<D = string|undefined>(name: string, defaultValue?: D): D {
        const {
            [name]: value = defaultValue
        } = this.metadata || {};

        return value as D;
    }

    public setMeta(name: string, value: string|boolean): void {
        if(!this.metadata) {
            this.metadata = {};
        }

        this.metadata[name] = typeof value === "boolean"
            ? (value ? "true" : "false")
            : value;
    }

    public unsetMeta(name: string): void {
        if(this.metadata && name in this.metadata) {
            delete this.metadata[name];
        }

        if(this.metadata && Object.keys(this.metadata).length === 0) {
            delete this.metadata;
        }
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
        this.volumes = (this.volumes || []).filter((mounted) => {
            return !volumes.includes(mounted);
        });
    }

    public async save() {
        if(!projectService) {
            throw new Error("Dependency is missing");
        }

        await projectService.save(this);
    }

    static install(di: DI): void {
        projectService = di.resolveService<ProjectService>(ProjectService);
    }

    static fromObject(data: any) {
        return new Project(data);
    }

    static async search(params: Partial<SearchOptions> = {}): Promise<Project[]> {
        if(!projectService) {
            throw new Error("Dependency is missing");
        }

        return projectService.search(params);
    }

    static async searchOne(params: Partial<SearchOptions>): Promise<Project|null> {
        const [project] = await Project.search(params);

        return project || null;
    }
}


export {Project};
export const PROJECT_TYPE_DOCKERFILE = "dockerfile";
export const PROJECT_TYPE_IMAGE = "image";
