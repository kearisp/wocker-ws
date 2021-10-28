export const buildOptions = (name: string, options: any) => {
    return Object.keys(options).map((key: string) => {
        return `--${name} ${key}=${options[key]}`;
    }).join(" ");
};
