import * as crypto from "crypto";
import {verifyPasswordHash} from "./verifyPasswordHash";


export const createEncryptionKey = (password: string, passwordHash: string) => {
    if(!verifyPasswordHash(password, passwordHash)) {
        throw new Error("Invalid password provided");
    }

    const [, saltValue] = passwordHash.split(":"),
          salt = Buffer.from(saltValue, "hex");

    return crypto.scryptSync(password, salt, 32);
};
