type Data = {
    [key: string]: string;
};

export const injectVariables = (str: string, data: Data) => {
    let res = str;

    Object.keys(data).forEach((key) => {
        const variableName = `\\$\\{${key}\\}`;
        const variableValue = data[key];
        const regex = new RegExp(variableName, 'g');
        res = res.replace(regex, variableValue);
    });

    return res;
};
