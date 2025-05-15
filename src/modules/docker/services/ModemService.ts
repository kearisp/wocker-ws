import {Injectable, ModemService as CoreModemService} from "@wocker/core";
import type Modem from "docker-modem";


@Injectable("MODEM_SERVICE")
export class ModemService extends CoreModemService {
    protected _modem?: Modem;

    public get modem(): Modem {
        if(!this._modem) {
            const Modem = require("docker-modem");

            this._modem = new Modem({
                socketPath: "/var/run/docker.sock"
            });
        }

        return this._modem!;
    }
}
