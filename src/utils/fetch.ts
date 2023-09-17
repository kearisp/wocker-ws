import * as https from "https";
import {RequestOptions} from "https";


type Options = {
    method?: "GET" | "POST",
};

export const fetch = async (url: string, options?: Options) => {
    const {
        method = "GET"
    } = options || {};

    const target = new URL(url);

    const params: RequestOptions = {
        method,
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: target.pathname
    };

    return new Promise((resolve, reject) => {
        const req = https.request(params, (res) => {
            let body = "";

            res.on("data", (data) => {
                body += data;
            });

            res.on("end", () => {
                resolve(body);
            });
        });

        req.on("error", reject);
        req.end();
    });
};
