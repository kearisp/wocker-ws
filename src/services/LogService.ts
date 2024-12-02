import {
    Injectable,
    LogService as CoreLogService
} from "@wocker/core";
import dateFormat from "date-fns/format";

import {FS, Logger} from "../makes";
import {AppConfigService} from "./AppConfigService";


@Injectable("LOG_SERVICE")
export class LogService extends CoreLogService {
    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {
        super();

        Logger.install(this);
    }

    public debug(...data: any[]): void {
        this._log("debug", ...data);
    }

    public log(...data: any[]): void {
        this._log("log", ...data);
    }

    public info(...data: any[]): void {
        this._log("info", ...data);
    }

    public warn(...data: any[]): void {
        this._log("warn", ...data);
    }

    public error(...data: any[]): void {
        this._log("error", ...data);
    }

    public clear(): void {
        const logPath = this.appConfigService.dataPath("ws.log");

        FS.writeFileSync(logPath, "");
    }

    protected _log(type: string, ...data: any[]): void {
        const config = this.appConfigService.getConfig();

        if(type === "debug" && !config.debug) {
            return;
        }

        const time = dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
        const logPath = this.appConfigService.dataPath("ws.log");

        const logData = data.map((item): string => {
            return typeof item !== "string" ? JSON.stringify(item) : item;
        }).join(" ");

        if(!FS.existsSync(logPath)) {
            FS.writeFileSync(logPath, "");
        }

        FS.appendFileSync(logPath, `[${time}] ${type}: ${logData}\n`);
    }
}
