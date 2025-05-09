import type {
    getPassword,
    setPassword,
    deletePassword,
    findPassword,
    findCredentials
} from "keytar";


export type Keytar = {
    getPassword: typeof getPassword;
    setPassword: typeof setPassword;
    deletePassword: typeof deletePassword;
    findPassword: typeof findPassword;
    findCredentials: typeof findCredentials;
};
