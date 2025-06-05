import {createPasswordHash} from "./createPasswordHash";


export const verifyPasswordHash = (password: string, passwordHash: string): boolean => {
    const [, salt = ""] = (passwordHash || "").split(":");

    return passwordHash === createPasswordHash(password, salt);
};
