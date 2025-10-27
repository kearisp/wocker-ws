import {
    Injectable,
    AppConfigService,
    AppFileSystemService,
    Project,
    ProjectRepository as CoreProjectRepository,
    ProjectRepositorySearchParams as SearchParams
} from "@wocker/core";


@Injectable()
export class ProjectRepository extends CoreProjectRepository{
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly fs: AppFileSystemService
    ) {
        super();
    }

    public getByName(name: string): Project {
        const ref = this.appConfigService.config.getProject(name),
              config = this.fs.readJSON(`projects/${name}/config.json`);

        return new Project({
            ...config,
            path: ref.path
        });
    }

    public save(project: Project): void {
        if(!project.name) {
            throw new Error("Project should has a name");
        }

        if(!project.path) {
            throw new Error("Project should has a path");
        }

        if(!project.id) {
            project.id = project.name;
        }

        if(!this.fs.exists(`projects/${project.name}`)) {
            this.fs.mkdir(`projects/${project.name}`, {
                recursive: true
            });
        }

        const {
            path,
            ...rest
        } = project.toObject();

        this.appConfigService.addProject(project.name, path);
        this.fs.writeJSON(`projects/${project.name}/config.json`, rest);
        this.appConfigService.save();
    }

    public search(params: SearchParams = {}): Project[] {
        const {name, path} = params,
              projects: Project[] = [];

        for(const ref of this.appConfigService.projects) {
            if(name && ref.name !== name) {
                continue;
            }

            if(path && ref.path !== path) {
                continue;
            }

            const project = this.getByName(ref.name);

            projects.push(project);
        }

        return projects;
    }

    public searchOne(params: SearchParams = {}): Project | null {
        const [project] = this.search(params);

        return project || null;
    }
}
