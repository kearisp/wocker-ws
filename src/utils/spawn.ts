import {spawn as processSpawn} from "child_process";


const spawn = async (command): Promise<void> => {
    return new Promise((resolve) => {
        let [
            prog,
            ...options
        ] = command.split(/\s+/);

        let worker = processSpawn(prog, options);

        worker.stdout.on("data", (data) => {
            console.log(`stdout: ${data}`);
        });

        worker.stderr.on("data", (data) => {
            console.error(`stderr: ${data}`);
        });

        worker.on("close", (code) => {
            console.log(`child process exited with code ${code}`);

            resolve(undefined);
        });
    });
};


export {spawn};