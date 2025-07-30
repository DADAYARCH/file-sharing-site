import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');


export async function handleChunkUpload(req, res) {
    try {
        const { fileId, fileName, index, total } = req.query;
        if (!fileId || !fileName || index == null || total == null) {
            return res.status(400).json({ error: 'Missing fileId, fileName, index or total' });
        }

        const idx = parseInt(index, 10);
        const tot = parseInt(total, 10);

        const chunkDir = path.join(UPLOAD_DIR, String(fileId));
        fs.mkdirSync(chunkDir, { recursive: true });

        let buffer;
        if (Buffer.isBuffer(req.body)) {
            buffer = req.body;
        } else if (req.body instanceof ArrayBuffer) {
            buffer = Buffer.from(new Uint8Array(req.body));
        } else if (ArrayBuffer.isView(req.body)) {
            buffer = Buffer.from(req.body);
        } else if (
            req.body != null &&
            typeof req.body === 'object' &&
            (req.body.type === 'Buffer' || req.body.type === 'ArrayBuffer') &&
            Array.isArray(req.body.data)
        ) {
            buffer = Buffer.from(req.body.data);
        } else {
            return res.status(400).json({ error: 'Invalid chunk body format' });
        }

        const chunkPath = path.join(chunkDir, String(idx));
        fs.writeFileSync(chunkPath, buffer);

        if (idx === tot - 1) {
            const finalPath = path.join(UPLOAD_DIR, String(fileName));
            const ws = fs.createWriteStream(finalPath);
            for (let i = 0; i < tot; i++) {
                ws.write(fs.readFileSync(path.join(chunkDir, String(i))));
            }
            ws.end();
            fs.rmSync(chunkDir, { recursive: true, force: true });
        }

        return res.json({ status: 'ok', index: idx });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
}
