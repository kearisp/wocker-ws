import {LogService} from "../services/LogService";


let logService: LogService | undefined;

class Logger {
    public static install(ls: LogService) {
        logService = ls;
    }

    public static log(...data: any[]): void {
        if(!logService) {
            throw new Error("Dependency is missing");
        }

        logService.log(...data);
    }

    public static info(...data: any[]): void {
        if(!logService) {
            throw new Error("Dependency is missing");
        }

        logService.info(...data);
    }

    public static warn(...data: any[]): void {
        if(!logService) {
            throw new Error("Dependency is missing");
        }

        logService.warn(...data);
    }

    public static error(...data: any[]): void {
        if(!logService) {
            throw new Error("Dependency is missing");
        }

        logService.error(...data);
    }
}


export {Logger};
