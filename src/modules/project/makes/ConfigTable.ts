import {ProjectLayerType} from "@wocker/core";
import {CliTable} from "@wocker/prompts";
import colors from "yoctocolors-cjs";


export class ConfigTable extends CliTable<ConfigTable.Config> {
    public constructor() {
        super({
            headers: [
                {label: "LAYER", name: "layer", format: ConfigTable.formatLayer},
                {label: "SERVICE", name: "service", format: ConfigTable.format},
                {label: "KEY", name: "key", format: ConfigTable.format},
                {label: "VALUE", name: "value", format: ConfigTable.format}
            ]
        });
    }

    protected static format(value: string | undefined, row: ConfigTable.Config): string {
        const text = value ?? "";

        if(row.overridden) {
            return colors.gray(text);
        }

        return text;
    }

    protected static formatLayer(layer: ProjectLayerType, row: ConfigTable.Config) {
        const label = ProjectLayerType.label(layer) + (row.overridden ? " (Overridden)" : "");

        return ConfigTable.format(label, row);
    }
}

export namespace ConfigTable {
    export type Config = {
        layer: ProjectLayerType;
        service?: string;
        key?: string;
        value?: string;
        overridden?: boolean;
    };

    export type ColumnName = keyof Config;
}
