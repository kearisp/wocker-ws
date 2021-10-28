import {
    ImageController,
    ProjectController
} from "./controllers";
import {
    LocaltunnelPlugin,
    MaildevPlugin,
    MariadbPlugin,
    MongodbPlugin,
    NgrokPlugin,
    PageKitePlugin,
    PostgresPlugin,
    PresetPlugin,
    ProjectPlugin,
    ProxmoxPlugin,
    ProxyPlugin,
    RedisPlugin,
    ServeoPlugin,
    TestPlugin
} from "./plugins";
import {
    AppConfigService,
    AppEventsService,
    ProjectService
} from "./services";
import {App} from "./App";


const appConfigService = new AppConfigService();
const appEventsService = new AppEventsService();
const projectService = new ProjectService(appConfigService, appEventsService);

const app = new App(appConfigService);

app.useController(new ImageController());
app.useController(new ProjectController(appConfigService, appEventsService, projectService));
app.usePlugin(new LocaltunnelPlugin(appConfigService, appEventsService, projectService));
app.usePlugin(new MaildevPlugin());
app.usePlugin(new MariadbPlugin());
app.usePlugin(new MongodbPlugin());
app.usePlugin(new NgrokPlugin(appEventsService, projectService));
app.usePlugin(new PageKitePlugin(appConfigService, appEventsService, projectService));
app.usePlugin(new PostgresPlugin());
app.usePlugin(new PresetPlugin(appConfigService, appEventsService));
app.usePlugin(new ProxmoxPlugin());
app.usePlugin(new ProxyPlugin(appConfigService, appEventsService, projectService));
app.usePlugin(new ProjectPlugin());
app.usePlugin(new RedisPlugin());
app.usePlugin(new ServeoPlugin(appConfigService, appEventsService, projectService));
app.usePlugin(new TestPlugin());


export {app};
