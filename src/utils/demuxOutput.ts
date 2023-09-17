export const demuxOutput = (buffer) => {
    let nextDataLength = null,
        output = Buffer.from([]);

    while(buffer.length > 0) {
        const header = bufferSlice(8);
        nextDataLength = header.readUInt32BE(4);

        const content = bufferSlice(nextDataLength);
        output = Buffer.concat([output, content]);
    }

    function bufferSlice(end) {
        const out = buffer.slice(0, end);

        buffer = Buffer.from(buffer.slice(end, buffer.length));

        return out;
    }

    return output;
};
