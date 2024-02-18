import {EnvConfig} from "../types";
import {DI} from "../makes";
import {
    PresetService,
    PresetServiceSearchOptions as SearchOptions
} from "../services/PresetService";


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

let _di: DI;

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
        return _di.resolveService<PresetService>(PresetService).save(this);
    }

    public getImageName(buildArgs?: EnvConfig): string {
        return _di.resolveService<PresetService>(PresetService).getImageName(this, buildArgs);
    }

    public static install(di: DI) {
        _di = di;
    }

    public static search(options: SearchOptions) {
        return _di.resolveService<PresetService>(PresetService).search(options);
    }

    public static searchOne(options: SearchOptions) {
        return _di.resolveService<PresetService>(PresetService).searchOne(options);
    }
}


export {Preset};
