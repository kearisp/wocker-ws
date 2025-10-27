import {
    AppConfigService,
    EventService,
    FileSystem,
    Injectable,
    LogService,
    ProcessService,
    Project,
    PROJECT_TYPE_COMPOSE,
    PROJECT_TYPE_DOCKERFILE,
    PROJECT_TYPE_IMAGE,
    PROJECT_TYPE_PRESET,
    ProjectService as CoreProjectService,
    ProjectRepositorySearchParams as SearchParams
} from "@wocker/core";
import {Cli} from "@kearisp/cli";
import {ComposeService, DockerService} from "../../docker";
import {PresetRepository, PresetService} from "../../preset";
import {ProjectRepository} from "../repositories/ProjectRepository";


class PublicCli extends Cli {
    public parseCommand(command: string, index: number): string[] {
        return super.parseCommand(command, index);
    }
}

@Injectable("PROJECT_SERVICE")
export class ProjectService extends CoreProjectService {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly processService: ProcessService,
        protected readonly eventService: EventService,
        protected readonly dockerService: DockerService,
        protected readonly composeService: ComposeService,
        protected readonly projectRepository: ProjectRepository,
        protected readonly presetService: PresetService,
        protected readonly presetRepository: PresetRepository,
        protected readonly logService: LogService
    ) {
        super();
    }

    public get(name?: string): Project {
        const project = name
            ? this.projectRepository.searchOne({name})
            : this.projectRepository.searchOne({
                path: this.processService.pwd()
            });

        if(!project) {
            throw new Error("Project not found");
        }

        if(name) {
            this.processService.chdir(project.path);
        }

        return project;
    }

    public search(params: SearchParams = {}): Project[] {
        return this.projectRepository.search(params);
    }

    public searchOne(params: SearchParams = {}): Project | null {
        return this.projectRepository.searchOne(params);
    }

    public save(project: Project): void {
        this.projectRepository.save(project);
    }

    public async start(project: Project, restart?: boolean, rebuild?: boolean, attach?: boolean): Promise<void> {
        if(restart || rebuild) {
            await this.stop(project);
        }

        await this.build(project, rebuild);

        await this.eventService.emit("project:beforeStart", project);

        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET: {
                let container = await this.dockerService.getContainer(project.containerName);

                const fs = new FileSystem(project.path);

                if(!container) {
                    container = await this.dockerService.createContainer({
                        name: project.containerName,
                        image: project.imageName,
                        cmd: project.cmd,
                        env: {
                            ...this.appConfigService.config.env || {},
                            ...project.env || {}
                        },
                        ports: project.ports || [],
                        volumes: (project.volumes || []).map((volume: string): string => {
                            const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;
                            const [, source, destination, options] = regVolume.exec(volume);

                            if(source.startsWith("/")) {
                                return volume;
                            }

                            return `${fs.path(source)}:${destination}` + (options ? `:${options}` : "");
                        }),
                        extraHosts: Object.keys(project.extraHosts || {}).map((host: string) => {
                            return `${project.extraHosts[host]}:${host}`;
                        })
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
                break;
            }

            case PROJECT_TYPE_COMPOSE: {
                await this.composeService.up({
                    context: project.path,
                    composefile: project.composefile
                });
                break;
            }
        }

        await this.eventService.emit("project:start", project);
        await this.eventService.emit("project:afterStart", project);

        if(attach) {
            switch(project.type) {
                case PROJECT_TYPE_IMAGE:
                case PROJECT_TYPE_DOCKERFILE:
                case PROJECT_TYPE_PRESET:
                    await this.dockerService.attach(project.containerName);
                    break;

                case PROJECT_TYPE_COMPOSE:
                    break;
            }
        }
    }

    public async stop(project: Project): Promise<void> {
        await this.eventService.emit("project:beforeStop", project);

        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET:
                await this.dockerService.removeContainer(project.containerName);
                break;

            case PROJECT_TYPE_COMPOSE: {
                await this.composeService.down({
                    context: project.path,
                    composefile: project.composefile
                });
                break;
            }
        }

        await this.eventService.emit("project:stop", project);
    }

    public async build(project: Project, rebuild?: boolean): Promise<void> {
        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
                await this.dockerService.pullImage(project.imageName);
                break;

            case PROJECT_TYPE_DOCKERFILE: {
                project.imageName = `project-${project.name}:develop`;
                project.save();

                if(rebuild) {
                    await this.dockerService.imageRm(project.imageName);
                }

                if(!await this.dockerService.imageExists(project.imageName)) {
                    await this.dockerService.buildImage({
                        version: this.appConfigService.isExperimentalEnabled("buildKit") ? "2" : "1",
                        tag: project.imageName,
                        buildArgs: project.buildArgs,
                        context: project.path,
                        dockerfile: project.dockerfile
                    });
                }
                break;
            }

            case PROJECT_TYPE_PRESET: {
                const preset = this.presetRepository.searchOne({
                    name: project.preset
                });

                if(preset.image) {
                    await this.dockerService.pullImage(preset.image);

                    project.imageName = preset.image;
                    project.save();
                }

                if(preset.dockerfile) {
                    project.imageName = this.presetService.getImageNameForProject(project, preset);
                    project.save();

                    if(rebuild) {
                        await this.dockerService.imageRm(project.imageName);
                    }

                    if(!await this.dockerService.imageExists(project.imageName)) {
                        await this.dockerService.buildImage({
                            version: this.appConfigService.isExperimentalEnabled("buildKit") ? "2" : "1",
                            tag: project.imageName,
                            labels: {
                                "org.wocker.preset": preset.name
                            },
                            buildArgs: project.buildArgs,
                            context: preset.path,
                            dockerfile: preset.dockerfile
                        });
                    }
                }
                break;
            }

            case PROJECT_TYPE_COMPOSE: {
                await this.composeService.build({
                    context: project.path,
                    composefile: project.composefile
                });
                break;
            }
        }

        await this.eventService.emit("project:build", project, rebuild);
    }

    public async attach(project: Project): Promise<void> {
        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET: {
                await this.dockerService.attach(project.containerName);
                break;
            }
        }
    }

    public async run(project: Project, script: string, service?: string, args: string[] = []): Promise<void> {
        if(!project.scripts || !project.scripts[script]) {
            throw new Error(`Script ${script} not found`);
        }

        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET: {
                const container = await this.dockerService.getContainer(project.containerName);

                if(!container) {
                    throw new Error("The project is not started");
                }

                const cli = new PublicCli();

                const cmd = cli.parseCommand(`command ${project.scripts[script]}`, 0);

                this.logService.debug(cmd);

                const exec = await container.exec({
                    AttachStdin: true,
                    AttachStdout: true,
                    AttachStderr: true,
                    Tty: process.stdin.isTTY,
                    Cmd: [...cmd, ...args || []]
                });

                const stream = await exec.start({
                    hijack: true,
                    stdin: true,
                    Tty: process.stdin.isTTY
                });

                await this.dockerService.attachStream(stream);
                break;
            }

            case PROJECT_TYPE_COMPOSE: {
                console.log(service, script, args);
                break;
            }
        }
    }

    public async exec(project: Project, command: string[]): Promise<void> {
        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET:
                await this.dockerService.exec(project.containerName, command, true);
                break;

            case PROJECT_TYPE_COMPOSE: {
                const [service, ...args] = command;

                await this.composeService.exec({
                    service,
                    args,
                    context: project.path,
                    composefile: project.composefile
                });
                break;
            }
        }
    }

    public async logs(project: Project, detach?: boolean): Promise<void> {
        switch(project.type) {
            case PROJECT_TYPE_IMAGE:
            case PROJECT_TYPE_DOCKERFILE:
            case PROJECT_TYPE_PRESET: {
                const container = await this.dockerService.getContainer(project.containerName);

                if(!container) {
                    throw new Error("Project not started");
                }

                if(!detach) {
                    await this.dockerService.logs(container);
                }
                else {
                    const data = await container.logs({
                        stdout: true,
                        stderr: true,
                        follow: false
                    });

                    process.stdout.write(data);
                }

                break;
            }

            case PROJECT_TYPE_COMPOSE:
                break;
        }
    }
}
