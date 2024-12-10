import {Plugin} from "@wocker/core";

import {ProxmoxController} from "./controllers/ProxmoxController";


@Plugin({
    name: "proxmox",
    controllers: [
        ProxmoxController
    ],
    providers: []
})
export class ProxmoxPlugin {}
