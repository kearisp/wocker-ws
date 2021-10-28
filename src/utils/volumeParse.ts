import {Volume} from "./volumeFormat";


export const volumeParse = (volume: string): Volume => {
    const regVolume = /^([^:]+):([^:]+)(?::([^:]+))?$/;

    const [, source, destination, options] = regVolume.exec(volume);

    return {
        source,
        destination,
        options
    };
};
