export const formatSizeUnits = (bytes: number) => {
    if(bytes >= 1073741824) {
        return (bytes / 1073741824).toFixed(2) + "GB";
    }
    else if(bytes >= 1048576) {
        return (bytes / 1048576).toFixed(2) + "MB";
    }
    else if(bytes >= 1024) {
        return (bytes / 1024).toFixed(2) + "kB";
    }
    else if(bytes >= 1) {
        return bytes + "b";
    }

    return "0b";
};
