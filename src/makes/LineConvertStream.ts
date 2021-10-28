import {Readable} from "stream";
import {Mutex} from "async-mutex";


class LineConvertStream extends Readable {
    protected stream: NodeJS.ReadableStream;
    protected buf = "";
    protected mutex: Mutex = new Mutex();

    constructor(stream: NodeJS.ReadableStream) {
        super();

        this.stream = stream;

        this.stream.on("data", (chunk) => this.process(chunk));

        this.stream.on("end", () => {
            this.push(null);
        });

        this.stream.on("close", () => {
            this.destroy();
        });
    }

    _read(size: number) {
        //
    }

    async process(chunk) {
        await this.mutex.acquire();

        this.buf += chunk.toString();

        try {
            let pos;

            while((pos = this.buf.indexOf("\n")) >= 0) {
                if(pos === 0) {
                    this.buf = this.buf.slice(0);
                    continue;
                }

                const line = this.buf.slice(0, pos);

                this.buf = this.buf.slice(pos + 1);

                this.push(line);
            }
        }
        finally {
            this.mutex.release();
        }
    }
}


export {LineConvertStream};
