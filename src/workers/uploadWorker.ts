interface MessageIn {
    file: File;
    chunkSize: number;
    fileId: string;
}

interface ProgressOut {
    loaded?: number;
    total: number;
    index?: number;
    done?: boolean;
    error?: boolean;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 300;
const CHUNK_TIMEOUT_MS = 30000;

function sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
}

async function uploadWithRetry(url: string, body: ArrayBuffer, attempt = 1): Promise<Response> {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), CHUNK_TIMEOUT_MS);

    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body,
            signal: controller.signal,
            cache: 'no-store',
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp;
    } catch (err) {
        if (attempt >= MAX_RETRIES) throw err;
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
        return uploadWithRetry(url, body, attempt + 1);
    } finally {
        clearTimeout(to);
    }
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
        if (i === 0) params.set('name', file.name);

        const url = `/api/upload-chunk?${params.toString()}`;

        try {
            await uploadWithRetry(url, buffer);
        } catch (e) {
            self.postMessage({ error: true, index: i, total } as ProgressOut);
            return;
        }

        loaded = end;
        self.postMessage({
            loaded,
            total,
            index: i,
            done: i === totalChunks - 1,
        } as ProgressOut);
    }
});
