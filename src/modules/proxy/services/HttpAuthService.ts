import {
    Injectable,
    AppFileSystemService,
    Project,
    ProcessService
} from "@wocker/core";
import {DockerService} from "@wocker/docker-module";
import {ProxyService} from "./ProxyService";


@Injectable()
export class HttpAuthService {
    public constructor(
        protected readonly processService: ProcessService,
        protected readonly fs: AppFileSystemService,
        protected readonly dockerService: DockerService,
        protected readonly proxyService: ProxyService
    ) {}

    public async users(path: string) {
        await this.dockerService.exec("wocker-proxy", {
            tty: true,
            user: "nginx",
            cmd: ["cut", "-d:", "-f1", `/etc/${path}`]
        });
    }

    public async add(path: string, user: string, password: string, algorithm: HttpAuthService.Algorithm = "md5") {
        const alMap = {
            md5: "-m",
            sha1: "-s",
            sha256: "-2",
            sha512: "-5",
            bcrypt: "-B",
        };

        if(!(algorithm in alMap)) {
            throw new Error(`Unsupported "${algorithm}" algorithm`);
        }

        if(!this.fs.exists(path)) {
            this.fs.writeFile(path, "", {
                mode: 0o640
            });
        }

        await this.dockerService.exec("wocker-proxy", {
            user: "nginx",
            cmd: ["htpasswd", "-b", alMap[algorithm], `/etc/${path}`, user, password],
            tty: true
        });
    }

    public async addForProject(project: Project, user: string, password: string, algorithm: HttpAuthService.Algorithm = "md5") {
        if(!this.fs.exists("nginx/htpasswd/projects")) {
            this.fs.mkdir("nginx/htpasswd/projects", {
                mode: 0o764
            });
        }

        await this.add(`nginx/htpasswd/projects/${project.name}`, user, password, algorithm);
    }

    public async addForGlobal(user: string, password: string, algorithm: HttpAuthService.Algorithm = "md5") {
        return this.add(
            `nginx/htpasswd/_global`,
            user,
            password,
            algorithm
        );
    }

    public async removeUser(path: string, user: string) {
        await this.dockerService.exec("wocker-proxy", {
            cmd: ["htpasswd", "-D", `/etc/${path}`, user],
            user: "nginx",
            tty: true
        });
    }

    public async usersForProject(project: Project) {
        if(!this.fs.exists("nginx/htpasswd/projects")) {
            return;
        }

        await this.users(
            `nginx/htpasswd/projects/${project.name}`
        )
    }

    public async removeForProject(project: Project, user: string) {
        if(!this.fs.exists("nginx/htpasswd/projects")) {
            return;
        }

        await this.removeUser(
            `nginx/htpasswd/projects/${project.name}`,
            user
        );
    }

    public async clearForProject(project: Project) {
        const filePath = `nginx/htpasswd/projects/${project.name}`;

        if(this.fs.exists(filePath)) {
            this.fs.writeFile(filePath, "", {
                mode: 0o640
            });
        }
    }

    public async enableForProject(project: Project, domain?: string) {
        if(!this.fs.exists(`nginx/htpasswd/projects/${project.name}`)) {
            throw new Error(`No htpasswd for ${project.name}`);
        }

        if(!domain) {
            for(const d of project.domains) {
                await this.enableForProject(project, d);
            }

            return;
        }

        if(!project.domains.includes(domain)) {
            throw new Error("Domain not related to project");
        }

        const filePath = `nginx/htpasswd/${domain}`;

        if(this.fs.exists(filePath)) {
            return;
        }

        this.fs.symlink(
            `nginx/htpasswd/projects/${project.name}`,
            filePath,
            "file"
        );
    }

    public async disableForProject(project: Project, domain?: string) {
        if(!domain) {
            for(const d of project.domains) {
                await this.disableForProject(project, d);
            }

            return;
        }

        const filePath = `nginx/htpasswd/${domain}`;

        if(!this.fs.exists(filePath)) {
            return;
        }

        const stat = this.fs.lstat(filePath);

        if(!stat.isSymbolicLink()) {
            return;
        }

        if(`projects/${project.name}` !== this.fs.readlink(filePath)) {
            return;
        }

        this.fs.unlink(filePath);
    }
}

export namespace HttpAuthService {
    export type Algorithm = "md5" | "sha1" | "sha256" | "sha512" | "bcrypt";
}
