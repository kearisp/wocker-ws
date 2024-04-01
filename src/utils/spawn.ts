import {spawn as processSpawn} from "child_process";


const spawn = async (command: string, args: string[]): Promise<void> => {
    const abortController = new AbortController();

    const child = processSpawn(command, args, {
        signal: abortController.signal,
        stdio: "inherit"
    });

    await new Promise((resolve, reject) => {
        let withError: boolean = false;

        child.on("close", (code) => {
            if(withError) {
                return;
            }

            if(code !== 0) {
                reject(new Error(`Process exited with code ${code}`));

                return;
            }

            resolve(undefined);
        });

        child.on("error", (err) => {
            withError = true;
            reject(err);
        });
    });
};


export {spawn};