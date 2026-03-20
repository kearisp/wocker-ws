type Data = {
    [key: string]: string;
};

export const injectVariables = (pattern: string, data: Data) => {
    return Object.entries(data).reduce((res, [key, value]) => {
        const regex = new RegExp(`\\$\\{${key}\\}`, "g");

        return res.replace(regex, value);
    }, pattern);
};
