interface MessageIn {
    file: File;
    chunkSize: number;
    fileId: string;
}

interface ProgressMsg {
    loaded: number;
    total: number;
    index: number;
    done?: boolean;
}

interface ErrorMsg {
    error: true;
    index: number;
}

self.addEventListener('message', async (ev: MessageEvent<MessageIn>) => {
    const { file, chunkSize, fileId } = ev.data;
    const total = file.size;
    const totalChunks = Math.ceil(total / chunkSize);

    for (let index = 0; index < totalChunks; index++) {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, total);
        const chunk = file.slice(start, end);
        const buffer = await chunk.arrayBuffer();

        try {
            const resp = await fetch(
                `/api/upload-chunk`
                + `?fileId=${encodeURIComponent(fileId)}`
                + `&fileName=${encodeURIComponent(file.name)}`
                + `&index=${index}&total=${totalChunks}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: buffer
                }
            );
            if (!resp.ok) throw new Error(`Chunk ${index} upload failed`);

            const msg: ProgressMsg = {
                loaded: end,
                total,
                index,
                done: index === totalChunks - 1
            };
            self.postMessage(msg);

            if (index === totalChunks - 1) {
                break;
            }

        } catch (err) {
            console.error(err);
            const errorMsg: ErrorMsg = { error: true, index };
            self.postMessage(errorMsg);
            break;
        }
    }
});
