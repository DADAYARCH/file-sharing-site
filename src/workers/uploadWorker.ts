interface MessageIn {
    file: File;
    chunkSize: number;
    fileId: string;
}

interface Progress {
    loaded: number;
    total: number;
    done?: boolean;
}

self.addEventListener('message', async ({ data }) => {
    const { file, chunkSize, fileId } = data as MessageIn;

    const total = file.size;
    const totalChunks = Math.ceil(total / chunkSize);
    let loaded = 0;

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, total);
        const chunk = file.slice(start, end);
        const buffer = await chunk.arrayBuffer();

        const params = new URLSearchParams({
            fileId,
            index: String(i),
            total: String(totalChunks),
        });
        if (i === 0) {
            params.set('name', encodeURIComponent(file.name));
        }

        const resp = await fetch(`/api/upload-chunk?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: buffer,
        });

        if (!resp.ok) {
            self.postMessage({ error: true, index: i, total, done: false } as Progress);
            return;
        }

        loaded = end;
        self.postMessage({
            loaded,
            total,
            index: i,
            done: i === totalChunks - 1,
        } as Progress);
    }
});
