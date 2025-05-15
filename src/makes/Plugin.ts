import {PLUGIN_NAME_METADATA} from "@wocker/core";


export class Plugin {
    public readonly name: string;

    constructor(
        public readonly type: any
    ) {
        const pluginName = Reflect.getMetadata(PLUGIN_NAME_METADATA, this.type);

        if(!pluginName || typeof pluginName !== "string") {
            throw new Error("Invalid plugin package");
        }

        this.name = pluginName;
    }
}
