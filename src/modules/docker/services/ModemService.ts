import {Injectable} from "@wocker/core";
import Modem from "docker-modem";


@Injectable()
export class ModemService {
    protected _modem?: Modem

    public get modem(): Modem {
        if(!this._modem) {
            this._modem = new Modem({
                socketPath: "/var/run/docker.sock"
            });
        }

        return this._modem;
    }
}
