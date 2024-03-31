import {Injectable} from "@wocker/core";
import dateFormat from "date-fns/format";

import {FS, Logger} from "../makes";
import {AppConfigService} from "./AppConfigService";


@Injectable("LOG_SERVICE")
export class LogService {
    public constructor(
        protected readonly appConfigService: AppConfigService
    ) {
        Logger.install(this);
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

    protected _log(type: string, ...data: any[]): void {
        const time = dateFormat(new Date(), "yyyy-MM-dd hh:mm:ss");
        const logPath = this.appConfigService.dataPath("ws.log");

        const logData = data.map((item) => {
            return typeof item !== "string" ? JSON.stringify(item) : item;
        }).join(" ");

        if(!FS.existsSync(logPath)) {
            FS.writeFileSync(logPath, "");
        }

        FS.appendFileSync(logPath, `[${time}] ${type}: ${logData}\n`);
    }
}
