export type Volume = {
    source: string;
    destination: string;
    options?: string;
};

export const volumeFormat = (volume: Volume) => {
    const {
        source,
        destination,
        options
    } = volume;

    return `${source}:${destination}` + (options ? `:${options}` : "");
};
