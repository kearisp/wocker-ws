// import {} from "tty";


const code = '\x1b[6n';


export const getCursorPosition = async () => {
    process.stdin.resume();
    process.stdin.setRawMode(true);

    const position: {row?: number; col?: number;} = {};

    await new Promise((resolve, reject) => {
        const handleData = (data) => {
            const match = /\[(\d+);(\d+)R$/.exec(data.toString());

            if(match) {
                const [, col, row] = match.slice(1, 3).reverse().map(Number);

                position.row = row;
                position.col = col;

                resolve(undefined);
            }

            // process.stdin.setRawMode(false);
            process.stdin.off("data", handleData);
            process.stdin.pause();
        };

        process.stdin.once("data", handleData);
        process.stdout.write(code);
        process.stdout.emit("data", code);
    });

    return position;
};
