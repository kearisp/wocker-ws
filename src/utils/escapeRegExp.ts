const escapeRegExp = (string:string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};


export {escapeRegExp};