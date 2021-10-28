import {prompt} from "inquirer";


type Options = {
    message?: string;
    default?: boolean;
};

export const promptConfirm = async (options: Options) => {
    const {
        message,
        default: defaultValue = true
    } = options;

    const res = await prompt({
        type: "confirm",
        name: "confirm",
        message,
        default: defaultValue
    });

    return res.confirm;
};

export {Options as PromptConfirmOptions};
