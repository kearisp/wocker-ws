import * as inquirer from "inquirer";


type Options = {
    message?: string;
    options: string[] | {[value: string]: string;} | {
        label?: string;
        value: string;
    }[];
    default?: string;
};

const promptSelect = async (props: Options) => {
    const {
        message = "Select: ",
        options: rawOptions,
        default: value
    } = props;

    const options = Array.isArray(rawOptions) ? rawOptions.map((option) => {
        return {
            label: typeof option === "string"
                ? option
                : option.label || option.value,
            value: typeof option === "string"
                ? option
                : option.value
        };
    }) : Object.keys(rawOptions).map((value) => {
        return {
            label: rawOptions[value],
            value
        };
    });

    const defaultOption = options.find((option) => {
        return option.value === value;
    });

    const res: any = await inquirer.prompt({
        type: "list",
        name: "value",
        message: `${message}: `,
        choices: options.map((option) => {
            return option.label || option.value;
        }),
        default: defaultOption ? (defaultOption.label || defaultOption.value) : ""
    });

    const option = options.find((option) => {
        return (option.label || option.value) === res.value;
    });

    if(option) {
        return option.value;
    }

    return "";
};


export {
    promptSelect,
    Options as PromptSelectOptions
};