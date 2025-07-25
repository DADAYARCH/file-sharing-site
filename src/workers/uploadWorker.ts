interface MessageIn {
    file: File;
    chunkSize: number;
    fileId: string;
}

interface Progress {
    loaded: number;
    total: number;
}

self.addEventListener('message', async ({ data }) => {
    const { file, chunkSize, fileId } = data as MessageIn;
    const subtler = crypto.subtle;

    const total = file.size;
    const totalChunks = Math.ceil(total / chunkSize);
    let loaded = 0;

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, total);
        const chunk = file.slice(start, end);

        await subtler.digest('SHA-256', await chunk.arrayBuffer());

        await fetch(
            `/api/upload-chunk?fileId=${fileId}&index=${i}&total=${totalChunks}`,
            { method: 'POST', body: chunk }
        );

        loaded = end;
        self.postMessage({ loaded, total } as Progress);
    }

    self.postMessage({ done: true });
});
