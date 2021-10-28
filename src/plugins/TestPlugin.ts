import * as Path from "path";
import * as os from "os";
import {Readable} from "stream";
import {Cli} from "@kearisp/cli";

import {Plugin, Logger, FS} from "src/makes";
import {followProgress} from "src/utils";


class TestPlugin extends Plugin {
    public constructor() {
        super("test");
    }

    public install(cli: Cli) {
        super.install(cli);

        cli.command("test")
            .action(() => this.test());

        cli.command("test2")
            .action(() => this.test2());

        cli.command("test:data")
            .action(() => this.testData());

        cli.command("test:info").action(async () => {
            Logger.info(Math.random());
        });

        cli.command("test:warning").action(async () => {
            Logger.warning(Math.random());
        });

        cli.command("test:error").action(async () => {
            Logger.error(Math.random());
        });

        cli.command("test:action")
            .action(async () => {
                const a = process.stdout.getWindowSize();

                Logger.info(a);

                // await Docker.attach("timer.workspace");
                // await Docker.attach("ngrok-timer");

                // let image = await Docker.getImage("node:lts");

                // console.log(image);
            });
    }

    public async test() {
        const readable = new Readable();

        const pause = async (time = 0) => {
            await new Promise((resolve) => setTimeout(resolve, time * 1000));
        };

        readable._read = () => undefined;

        followProgress(readable);

        const chunks = [
            "{\"stream\":\"Step 1/13 : ARG PHP_VERSION\"}\n",
            "{\"stream\":\"\\n\"}\n",
            "{\"stream\":\"Step 2/13 : FROM php:${PHP_VERSION}-apache\"}\n",
            "{\"stream\":\"\\n\"}\n",
            "{\"status\":\"Pulling from library/php\",\"id\":\"5.6-apache\"}\n",
            "{\"status\":\"Pulling fs layer\",\"progressDetail\":{},\"id\":\"5e6ec7f28fb7\"}\n",
            "{\"status\":\"Pulling fs layer\",\"progressDetail\":{},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Waiting\",\"progressDetail\":{},\"id\":\"5e6ec7f28fb7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":10,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":25,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":50,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":100,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":120,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":200,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":229,\"total\":229},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Download complete\",\"progressDetail\":{},\"id\":\"cf165947b5b7\"}\n",
            "{\"status\":\"Digest: sha256:0a40fd273961b99d8afe69a61a68c73c04bc0caa9de384d3b2dd9e7986eec86d\"}\n",
            "{\"aux\":{\"ID\":\"sha256:87ebbade0d24f347f4067955aad05690956e610dfc0e20c5b278b415c1c36dfc\"}}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":15,\"total\":100},\"id\":\"5e6ec7f28fb7\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":30,\"total\":100},\"id\":\"5e6ec7f28fb7\"}\n",
            "{\"status\":\"Download complete\",\"progressDetail\":{},\"id\":\"5e6ec7f28fb7\"}\n",
            "{\"stream\":\"\\u001b[91m\\r#                                1.0%\\u001b[0m\"}\n",
            "{\"stream\":\"\\u001b[91m\\r##                               2.0%\\u001b[0m\"}\n",
            "{\"stream\":\"Long line ..................................................................................\\rReplace long line.............\\n\"}\n",
            "{\"stream\":\"\\u001b[91m\\r###                              3.0%\\u001b[0m\"}\n",
            "{\"stream\":\"\\u001b[91m\\r#####                            5.0%\\u001b[0m\"}\n",
            "{\"stream\":\"\\u001b[91m\\r######                           5.0%\\u001b[0m\"}\n",
            "{\"stream\":\"\\u001b[91m\\r#######                          5.0%\\u001b[0m\"}\n",
            "{\"stream\":\"\\n\"}\n",
            "{\"stream\":\"\\n\"}\n",
            "{\"status\":\"Downloading\",\"progressDetail\":{\"current\":100,\"total\":100},\"id\":\"5e6ec7f28fb7\"}\n",
        ];

        for(const chunk of chunks) {
            readable.push(chunk);

            await pause(0.5);
        }
    }

    public async testData() {
        const homedir = os.homedir();

        Logger.info(homedir);
    }

    public async test2() {
        process.stdout.write("1 Line\n");
        process.stdout.write("2 Line\n\n");
        process.stdout.write(`\x1b[1A`);
        process.stdout.write("3 Line\n");
        process.stdout.write("4 Line\n");
        process.stdout.write(`\x1b[s`);
        process.stdout.write("5 Line\n");
        process.stdout.write(`\x1b[1A`);
        process.stdout.write("Not 5 Line\n");
        process.stdout.write(`\x1b[u`);
        process.stdout.write("6 Line\n");
    }
}


export {TestPlugin};
