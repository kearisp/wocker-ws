import {exec as processExec, ExecOptions} from "child_process";


type Options = Omit<ExecOptions, "maxBuffer">;

const exec = async (command: string, options?: Options): Promise<string> => {
    const worker = processExec(command, {
        ...options || {},
        maxBuffer: Infinity
    } as any);

    return new Promise((resolve, reject) => {
        let data = "";

        worker.stdout.on("data", (chunk) => {
            data += chunk.toString();
        });

        worker.on("exit", (code) => {
            if(code !== 0) {
                reject(new Error(`Process exited with code ${code}`));
                return;
            }

            resolve(data.replace(/\n$/, ""));
        });

        worker.on("error", (err) => {
            reject(err);
        });
    });
};


export {exec};