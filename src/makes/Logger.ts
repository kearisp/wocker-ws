import {DI} from "./DI";
import {LogService} from "../services/LogService";


let _di: DI;

class Logger {
    public static install(di: DI) {
        _di = di;
    }

    public static log(...data: any[]): void {
        _di.resolveService<LogService>(LogService).log(...data);
    }

    public static info(...data: any[]): void {
        _di.resolveService<LogService>(LogService).info(...data);
    }

    public static warn(...data: any[]): void {
        _di.resolveService<LogService>(LogService).warn(...data);
    }

    public static error(...data: any[]): void {
        _di.resolveService<LogService>(LogService).error(...data);
    }
}


export {Logger};
