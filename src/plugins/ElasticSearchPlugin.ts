import {
    DI,
    AppConfigService,
    DockerService,
    Plugin,
    FSManager
} from "@wocker/core";
import {Cli} from "@kearisp/cli";


type StartOptions = {
    restart?: boolean;
};

class ElasticSearchPlugin extends Plugin {
    protected containerName = "elastic-search.workspace";
    protected appConfigService: AppConfigService;
    protected dockerService: DockerService;
    protected fs: FSManager;

    public constructor(di: DI) {
        super();

        this.appConfigService = di.resolveService<AppConfigService>(AppConfigService);
        this.dockerService = di.resolveService<DockerService>(DockerService);

        this.fs = new FSManager(
            this.appConfigService.pluginsPath("elastic-search"),
            this.appConfigService.dataPath("plugins/elastic-search")
        );
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("elastica:start")
            .option("restart", {
                type: "boolean",
                alias: "r",
                description: "Restart service"
            })
            .action((options) => this.start(options));

        cli.command("elastica:stop")
            .action(() => this.stop());
    }

    public async start(options: StartOptions) {
        const {
            restart
        } = options;

        await this.dockerService.pullImage("docker.elastic.co/elasticsearch/elasticsearch:7.5.2");

        let container = await this.dockerService.getContainer(this.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(this.containerName);

            container = null;
        }

        if(!container) {
            await this.fs.mkdir("data", {
                recursive: true
            });

            container = await this.dockerService.createContainer({
                name: this.containerName,
                image: "docker.elastic.co/elasticsearch/elasticsearch:7.5.2",
                ulimits: {
                    memlock: {
                        hard: -1,
                        soft: -1
                    }
                },
                env: {
                    "node.name": "elasticsearch",
                    "cluster.name": "elasticsearch",
                    "cluster.initial_master_nodes": "elasticsearch",
                    "bootstrap.memory_lock": "false",
                    ES_JAVA_OPTS: "-Xms512m -Xmx512m"
                },
                volumes: [
                    `${this.fs.path("data")}:/usr/share/elasticsearch/data`
                ],
                ports: [
                    "9200:9200"
                ]
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
    }

    async stop() {
        await this.dockerService.removeContainer(this.containerName);
    }
}


export {ElasticSearchPlugin};