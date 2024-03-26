import {EnvConfig} from "@wocker/core";
import {
    PresetService,
    PresetServiceSearchOptions as SearchOptions
} from "../services/PresetService";


let presetService: PresetService | undefined;

type TextOption = {
    type: "string" | "number" | "int";
    message?: string;
    default?: string | number;
};

type ConfirmOption = {
    type: "boolean";
    message?: string;
    default?: boolean;
};

type SelectOption = {
    type: "select";
    options: string[]|{label?: string; value: string}[]|{[name: string]: string};
    message?: string;
    default?: string;
};

type AnyOption = TextOption | ConfirmOption | SelectOption;

class Preset {
    public id: string;
    public name: string;
    public version: string;
    public dockerfile?: string;
    public buildArgsOptions?: {
        [name: string]: AnyOption;
    };
    public envOptions?: {
        [name: string]: AnyOption;
    };
    public volumes?: string[];
    public volumeOptions?: string[];

    public constructor(data: any) {
        this.id = data.id;
        this.name = data.name;
        this.version = data.version;
        this.dockerfile = data.dockerfile;
        this.buildArgsOptions = data.buildArgsOptions;
        this.envOptions = data.envOptions;
        this.volumes = data.volumes;
        this.volumeOptions = data.volumeOptions;
    }

    public async save(): Promise<void> {
        if(!presetService) {
            throw new Error("Dependency is missing");
        }

        return presetService.save(this);
    }

    public getImageName(buildArgs?: EnvConfig): string {
        if(!presetService) {
            throw new Error("Dependency is missing");
        }

        return presetService.getImageName(this, buildArgs);
    }

    public static install(ps: PresetService) {
        presetService = ps;
    }

    public static search(options: SearchOptions) {
        if(!presetService) {
            throw new Error("Dependency is missing");
        }

        return presetService.search(options);
    }

    public static searchOne(options: SearchOptions) {
        if(!presetService) {
            throw new Error("Dependency is missing");
        }

        return presetService.searchOne(options);
    }
}


export {Preset};
