import {Injectable, Project, ProjectProperties} from "@wocker/core"
import * as Path from "path";

import {FS} from "../makes";
import {
    DockerService,
    AppConfigService,
    AppEventsService,
} from "../services";


type SearchParams = Partial<{
    id: string;
    name: string;
    path: string;
}>;

@Injectable("PROJECT_SERVICE")
class ProjectService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly appEventsService: AppEventsService,
        protected readonly dockerService: DockerService
    ) {}

    public fromObject(data: Partial<ProjectProperties>): Project {
        const _this = this;

        return new class extends Project {
            public constructor(data: ProjectProperties) {
                super(data);
            }

            public async save(): Promise<void> {
                await _this.save(this);
            }
        }(data as ProjectProperties);
    }

    public async getById(id: string): Promise<Project> {
        const data = await FS.readJSON(this.appConfigService.dataPath("projects", id, "config.json"));

        return this.fromObject(data);
    }

    public async cdProject(name: string): Promise<void> {
        const project = await this.searchOne({
            name
        });

        if(!project) {
            throw new Error("Project not found");
        }

        this.appConfigService.setPWD(project.path);
    }

    public async get(): Promise<Project> {
        const project = await this.searchOne({
            path: this.appConfigService.getPWD()
        });

        if(!project) {
            throw new Error("Project not found");
        }

        return project;
    }

    public async start(project: Project, rebuild?: boolean, restart?: boolean): Promise<void> {
        let container = await this.dockerService.getContainer(project.containerName);

        if(container && (restart || rebuild)) {
            container = null;

            await this.appEventsService.emit("project:stop", project);

            await this.dockerService.removeContainer(project.containerName);
        }

        if(!container) {
            await this.appEventsService.emit("project:beforeStart", project);

            if(project.type === "dockerfile") {
                project.imageName = `project-${project.name}:develop`;

                if(rebuild) {
                    await this.dockerService.imageRm(project.imageName);
                }

                const images = await this.dockerService.imageLs({
                    tag: project.imageName
                });

                if(images.length === 0) {
                    await this.dockerService.buildImage({
                        tag: project.imageName,
                        buildArgs: project.buildArgs,
                        context: this.appConfigService.getPWD(),
                        src: project.dockerfile
                    });
                }
            }

            if(rebuild) {
                await this.appEventsService.emit("project:rebuild", project);
            }

            const config = await this.appConfigService.getConfig();

            container = await this.dockerService.createContainer({
                name: project.containerName,
                image: project.imageName,
                env: {
                    ...config.env || {},
                    ...project.env || {}
                },
                volumes: (project.volumes || []).map((volume: string) => {
                    const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;
                    const [, source, destination, options] = regVolume.exec(volume);

                    return `${Path.join(this.appConfigService.getPWD(), source)}:${destination}` + (options ? `:${options}` : "");
                }),
                ports: project.ports || []
            });
        }

        const {
            State: {
                Status
            }
        } = await container.inspect();

        if(Status === "created" || Status === "exited") {
            await container.start();
        }

        await this.appEventsService.emit("project:start", project);
    }

    public async stop(project: Project): Promise<void> {
        const container = await this.dockerService.getContainer(project.containerName);

        if(!container) {
            return;
        }

        await this.appEventsService.emit("project:stop", project);

        await this.dockerService.removeContainer(project.containerName);
    }

    public async save(project: Project) {
        if(!project.name) {
            throw new Error("Project should has a name");
        }

        if(!project.path) {
            throw new Error("Project should has a path");
        }

        if(!project.id) {
            project.id = project.name;
        }

        const projectDirPath = this.appConfigService.dataPath("projects", project.id);
        const config = await this.appConfigService.getConfig();
        const configPath = this.appConfigService.dataPath("projects", project.id, "config.json");

        if(!FS.existsSync(projectDirPath)) {
            await FS.mkdir(projectDirPath, {
                recursive: true
            } as any);
        }

        config.setProject(project.id, project.path);

        await FS.writeJSON(configPath, project);
        await config.save();
    }

    public async search(params: Partial<SearchParams> = {}): Promise<Project[]> {
        const {id, name, path} = params;

        const config = await this.appConfigService.getConfig();

        const projects: Project[] = [];

        for(const projectConfig of config.projects) {
            if(id && projectConfig.id !== id) {
                continue;
            }

            if(path && projectConfig.src !== path) {
                continue;
            }

            const project = await this.getById(projectConfig.id);

            if(name && project.name !== name) {
                continue;
            }

            projects.push(project);
        }

        return projects;
    }

    public async searchOne(params: Partial<SearchParams> = {}): Promise<Project | null> {
        const [project] = await this.search(params);

        return project || null;
    }
}


export {ProjectService};
