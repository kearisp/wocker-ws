import * as Path from "path";

import {Docker, Logger} from "src/makes";
import {Project} from "src/models";
import {AppConfigService} from "./AppConfigService";
import {AppEventsService} from "./AppEventsService";


class ProjectService {
    public constructor(
        protected appConfigService: AppConfigService,
        protected appEventsService: AppEventsService
    ) {}

    public async cdProject(name: string) {
        const project = await Project.searchOne({
            name
        });

        if(!project) {
            throw new Error("Project not found");
        }

        this.appConfigService.setPWD(project.path);
    }

    public async get() {
        const project = await Project.searchOne({
            src: this.appConfigService.getPWD()
        });

        if(!project) {
            throw new Error("Project not found");
        }

        return project;
    }

    public async start() {
        const project = await this.get();

        if(project.type === "dockerfile") {
            project.imageName = `project-${project.name}:develop`;

            const images = await Docker.imageLs({
                tag: project.imageName
            });

            if(images.length === 0) {
                await Docker.imageBuild2({
                    tag: project.imageName,
                    context: this.appConfigService.getPWD(),
                    src: project.dockerfile
                });
            }
        }

        await this.appEventsService.emit("project:beforeStart", project);

        const containerName = `${project.name}.workspace`;

        let container = await Docker.getContainer(containerName);

        if(!container) {
            container = await Docker.createContainer({
                name: containerName,
                image: project.imageName,
                env: {
                    ...await this.appConfigService.getAllEnvVariables(),
                    ...project.env || {}
                },
                volumes: (project.volumes || []).map((volume: string) => {
                    const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;
                    const [, source, destination, options] = regVolume.exec(volume);

                    return `${Path.join(this.appConfigService.getPWD(), source)}:${destination}` + (options ? `:${options}` : "");
                })
            });
        }
        else {
            process.stdout.write("Container already exists\n");
        }

        if(container) {
            const {
                State: {
                    Status
                }
            } = await container.inspect();

            if(Status === "created" || Status === "exited") {
                await container.start();

                await this.appEventsService.emit("project:start", project);
            }
        }
    }

    public async stop() {
        const project = await this.get();

        const container = await Docker.getContainer(`${project.name}.workspace`);

        if(container) {
            await this.appEventsService.emit("project:stop", project);

            await Docker.removeContainer(`${project.name}.workspace`);
        }
    }
}


export {ProjectService};
