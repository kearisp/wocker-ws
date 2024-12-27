import crypto from "crypto";


export const createPasswordHash = (password: string, salt?: string): string => {
    const saltBuffer = salt
        ? Buffer.from(salt, "hex")
        : crypto.randomBytes(16);

    if(!salt) {
        salt = saltBuffer.toString("hex");
    }

    const hash = crypto.createHmac("sha256", saltBuffer)
        .update(password)
        .digest("hex");

    return `${hash}:${salt}`;
};
