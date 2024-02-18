import * as Path from "path";

import {exec} from "./exec";


type Options = {
    tag: string;
    buildArgs?: {
        [key: string]: string;
    };
    labels?: {
        [key: string]: string;
    };
    context: string;
    src: string;
};

export const imageBuild = async (options: Options) => {
    const {
        tag,
        buildArgs = {},
        labels = {},
        context,
        src
    } = options;

    const buildArgsString = Object.keys(buildArgs).map((key) => {
        return `--build-arg ${key}=${buildArgs[key]}`;
    }).join(" ");

    const labelsString = Object.keys(labels).map((key) => {
        return `--label ${key}=${labels[key]}`;
    }).join(" ");

    await exec(`
        docker build \
            --tag "${tag}" \
            ${buildArgsString} \
            ${labelsString} \
            --file ${Path.join(context, src)} \
            ${context}
    `);
};
