import {
    Injectable,
    AppConfigService,
    AppFileSystemService,
    Project,
    ProjectProperties,
    ProjectServiceSearchParams as SearchParams
} from "@wocker/core";
import {KeystoreService} from "../../keystore";


@Injectable()
export class ProjectRepository {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly fs: AppFileSystemService,
        protected readonly keystoreService: KeystoreService
    ) {}

    public getByName(name: string) {
        const ref = this.appConfigService.config.getProject(name),
              config = this.fs.readJSON(`projects/${name}/config.json`);

        return this.fromObject({
            ...config,
            path: ref.path
        });
    }

    public fromObject(data: Partial<ProjectProperties>): Project {
        const _this = this;

        return new class extends Project {
            public constructor(data: ProjectProperties) {
                super(data);
            }

            public async getSecret(key: string, defaultValue?: string) {
                return _this.keystoreService.get(`p:${this.name}:${key}`, defaultValue);
            }

            public async setSecret(key: string, value: string) {
                return _this.keystoreService.set(`p:${this.name}:${key}`, value);
            }

            public save(): void {
                _this.save(this);
            }
        }(data as ProjectProperties);
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

        if(!this.fs.exists(`projects/${project.id}`)) {
            this.fs.mkdir(`projects/${project.id}`, {
                recursive: true
            });
        }

        const {
            path,
            ...rest
        } = project.toObject();

        this.appConfigService.addProject(project.id, project.name, path);
        this.fs.writeJSON(`projects/${project.id}/config.json`, rest);
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
