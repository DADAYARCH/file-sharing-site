export function createUploadWorker(): Worker {
    return new Worker(new URL('./uploadWorker.ts', import.meta.url), { type: 'module' });
}