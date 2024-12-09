import {
    Controller,
    Description,
    Command,
    Option,
    FileSystemManager,
    DockerService,
    AppConfigService
} from "@wocker/core";


@Controller()
export class ElasticSearchController {
    protected containerName = "elastic-search.workspace";
    protected fs: FileSystemManager;

    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService
    ) {
        this.fs = new FileSystemManager(
            this.appConfigService.pluginsPath("elastic-search"),
            this.appConfigService.dataPath("plugins/elastic-search")
        );
    }

    @Command("elastica:start")
    @Description("Start Elastic Search")
    public async start(
        @Option("restart", {
            alias: "r",
            description: "Restarting elastic search"
        })
        restart?: boolean
    ): Promise<void> {
        await this.dockerService.pullImage("docker.elastic.co/elasticsearch/elasticsearch:7.5.2");

        let container = await this.dockerService.getContainer(this.containerName);

        if(restart && container) {
            await this.dockerService.removeContainer(this.containerName);

            container = null;
        }

        if(!container) {
            this.fs.mkdir("data", {
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
                    `${this.fs.destination.path("data")}:/usr/share/elasticsearch/data`
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

    @Command("elastica:stop")
    @Description("Stop Elastic Search")
    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.containerName);
    }
}
