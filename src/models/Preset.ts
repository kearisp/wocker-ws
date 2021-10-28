import * as  Path from "path";
import md5 from "md5";

import {PRESETS_DIR} from "src/env";
import {FS} from "src/makes";
import {PromptGroupOptions} from "src/utils";

import {Project} from "./Project";


export class Preset {
    id: string;
    name: string;
    dockerfile?: string;
    buildArgsOptions?: PromptGroupOptions<{
        hash?: boolean;
    }>;
    envOptions?: PromptGroupOptions;
    volumeOptions?: string[];
    volumes?: string[];

    public constructor(data?: Preset) {
        if(data) {
            for(const i in data) {
                this[i] = data[i];
            }
        }
    }

    public getImageArgs(project: Project) {
        if(!this.buildArgsOptions) {
            return {};
        }

        return Object.keys(this.buildArgsOptions).reduce((buildArgs: Project["buildArgs"], key: string) => {
            buildArgs[key] = project.buildArgs[key];

            return buildArgs;
        }, {});
    }

    public getImageName(buildArgs: {[key: string]: string;}) {
        const rawValues = [];
        const hashValues = [];

        Object.keys(buildArgs).forEach((key: string) => {
            const {
                [key]: {
                    hash = true
                } = {}
            } = this.buildArgsOptions || {};

            const value = buildArgs[key];

            if(hash) {
                hashValues.push(value);
            }
            else {
                rawValues.push(value);
            }
        });

        const version = [
            ...rawValues,
            md5(hashValues.join(",")).substr(0, 6)
        ].filter((value) => {
            return !!value;
        }).join("-");

        return `ws-preset-${this.name}:${version}`;
    }

    static async get(name: string) {
        const data = await FS.readJSON(Path.join(PRESETS_DIR, name, "config.json"));

        return new Preset({
            name,
            ...data
        });
    }
}
