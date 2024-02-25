import {App} from "./App";
import {
    ElasticSearchPlugin,
    LocaltunnelPlugin,
    MaildevPlugin,
    MongodbPlugin,
    NgrokPlugin,
    PageKitePlugin,
    PostgresPlugin,
    ProxmoxPlugin,
    RedisPlugin
} from "./plugins";


const app = new App();

app.use(ElasticSearchPlugin);
app.use(LocaltunnelPlugin);
app.use(MaildevPlugin);
app.use(MongodbPlugin);
app.use(NgrokPlugin);
app.use(PageKitePlugin);
app.use(PostgresPlugin);
app.use(ProxmoxPlugin);
app.use(RedisPlugin);


export {app};
export * from "./decorators";
export * from "./makes";
export * from "./services";
