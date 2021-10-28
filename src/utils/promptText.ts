import {prompt, Transformer} from "inquirer";
import chalk from "chalk";


type Options = {
    required?: boolean;
    /**
     * @deprecated Use label instead
     */
    message?: string;
    label?: string;
    prefix?: string;
    suffix?: string;
    type?: "string"|"integer";
    default?: string;
    transformer?: Transformer;
};

export const promptText = async (props: Options) => {
    const {
        required,
        message = "Prompt",
        label = message || "Prompt",
        prefix = "",
        suffix = "",
        type = "string",
        default: defaultValue,
        transformer
    } = props;

    const res = await prompt({
        message: `${label}: `,
        name: "value",
        type: "input",
        default: defaultValue,
        validate(value: string): boolean | string | Promise<boolean | string> {
            if(required) {
                if(typeof value === "undefined" || value === "") {
                    return "Mandatory value";
                }
            }

            if(type === "integer") {
                if(isNaN(parseInt(value)) || parseInt(value).toString() !== value) {
                    return "Should be integer";
                }
            }

            return true;
        },
        transformer: transformer || ((value: string) => {
            if(!prefix && !suffix) {
                return value;
            }

            if(suffix) {
                setTimeout(() => {
                    process.stdout.write(`\x1b[${suffix.length}D`);
                }, 0);
            }

            return `${chalk.gray(prefix)}${value}${chalk.gray(suffix)}`;
        })
    });

    return res.value;
};

export {Options as PromptTextOptions};
