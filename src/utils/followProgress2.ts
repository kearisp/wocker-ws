import protobuf from "protobufjs";
import colors from "yoctocolors-cjs";
import {ROOT_DIR} from "../env";


export const followProgress2 = async (stream: NodeJS.ReadableStream) => {
    const root = await protobuf.load([
        `${ROOT_DIR}/proto/solver/pb/ops.proto`,
        `${ROOT_DIR}/proto/buildkit.proto`
    ]);

    const StatusResponse = root.lookupType("moby.buildkit.v1.StatusResponse");

    return new Promise<void>((resolve, reject) => {
        let isEnded = false;
        let success = 0,
            error = 0;

        const handleEnd = () => {
            if(!isEnded) {
                isEnded = true;
                console.log(`success: ${success} errors: ${error}`);
                resolve();
                return;
            }
        };

        stream.on("data", (data) => {
            const content: string = data.toString().replace(/}\s*\{/g, '},{'),
                  items: any[] = JSON.parse(`[${content}]`);

            for(const item of items) {
                switch(item.id) {
                    case "moby.buildkit.trace": {
                        if(!item.aux) {
                            break;
                        }

                        let buffer = Buffer.from(item.aux, "base64");

                        try {
                            const decoded = StatusResponse.decode(buffer);

                            const obj = StatusResponse.toObject(decoded, {
                                enums: String,
                                longs: String,
                                bytes: String,  // або: Buffer, залежно від потреб
                                defaults: true,
                            });

                            console.dir(obj, {depth: null});

                            success++;
                        }
                        catch(err) {
                            error++;
                            console.error(colors.red(`Error: ${err.message}`));
                        }
                        break;
                    }

                    default:
                        break;
                }
            }
        });
        stream.on("end", handleEnd);
        stream.on("close", handleEnd);
        stream.on("error", reject);
    });
};
