import {promptConfirm, PromptConfirmOptions} from "./promptConfirm";
import {promptSelect, PromptSelectOptions} from "./promptSelect";
import {promptText, PromptTextOptions} from "./promptText";


type Values = {
    [key: string]: string;
};

type Option = ({type: "boolean"} & PromptConfirmOptions) | PromptTextOptions | ({type: "select";} & PromptSelectOptions);

type Options<T = unknown> = {
    [key: string]: Option & T;
};

export const promptGroup = async (values: Values, options: Options): Promise<Values> => {
    for(const key in options) {
        const value = values[key];
        const option = options[key];

        switch(option.type) {
            case "boolean":
                values[key] = await promptConfirm({
                    ...option,
                    default: typeof value !== "undefined"
                        ? value === "true"
                        : true
                });

                values[key] = values[key].toString();
                break;

            case "string":
            case "integer":
                values[key] = await promptText({
                    ...option,
                    default: typeof value !== "undefined" ? value : option.default || ""
                });
                break;

            case "select":
                values[key] = await promptSelect({
                    ...option,
                    default: typeof value !== "undefined" ? value : option.default || ""
                });
                break;
        }
    }

    return values;
};

export {Options as PromptGroupOptions};
