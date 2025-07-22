export interface ChunkOffset {
    start: number;
    end: number;
}

export function getChunks(fileSize: number, chunkSize: number): ChunkOffset[] {
    const total = Math.ceil(fileSize / chunkSize);
    const offsets: ChunkOffset[] = [];
    for (let i = 0; i < total; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, fileSize);
        offsets.push({ start, end });
    }
    return offsets;
}
