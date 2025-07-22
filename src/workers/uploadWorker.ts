import type { ChunkOffset } from '../utils/chunker';

interface MessageIn {
    file: File;
    chunkSize: number;
}

interface Progress {
    index: number;
    total: number;
}

self.addEventListener('message', async ({ data }) => {
    const { file, chunkSize } = data as MessageIn;
    const { default: crypto } = await import('node:crypto');

    const totalChunks = Math.ceil(file.size / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, file.size);
        const chunk = file.slice(start, end);
        const hashBuffer = await crypto.subtle.digest('SHA-256', await chunk.arrayBuffer());

        self.postMessage<Progress>({ index: i, total: totalChunks });

        // здесь заменить на реальный POST, если сервер уже готов
        // await fetch('/api/upload-chunk', { method: 'POST', body: chunk, headers: { 'X-Chunk-Index': String(i) } });
    }

    self.postMessage({ done: true });
});
