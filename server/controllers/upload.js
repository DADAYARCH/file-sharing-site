import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');

export async function handleChunkUpload(req, res) {
    try {
        const { fileId, index, total, name } = req.query;
        const idx = parseInt(index, 10);
        const tot = parseInt(total, 10);
        if (!fileId || isNaN(idx) || isNaN(tot)) {
            return res.status(400).json({ error: 'Missing fileId, index or total' });
        }

        const chunkDir = path.join(UPLOAD_DIR, fileId);
        fs.mkdirSync(chunkDir, { recursive: true });

        if (idx === 0 && typeof name === 'string') {
            const decodedName = decodeURIComponent(name);
            fs.writeFileSync(
                path.join(UPLOAD_DIR, `${fileId}.json`),
                JSON.stringify({ name: decodedName })
            );
        }

        let buffer;
        if (Buffer.isBuffer(req.body)) {
            buffer = req.body;
        } else if (req.body instanceof ArrayBuffer) {
            buffer = Buffer.from(req.body);
        } else if (ArrayBuffer.isView(req.body)) {
            buffer = Buffer.from(req.body);
        } else if (
            req.body != null &&
            typeof req.body === 'object' &&
            Array.isArray(req.body.data)
        ) {
            buffer = Buffer.from(req.body.data);
        } else {
            return res.status(400).json({ error: 'Invalid chunk body format' });
        }

        const chunkPath = path.join(chunkDir, String(idx));
        fs.writeFileSync(chunkPath, buffer);

        if (idx === tot - 1) {
            const finalPath = path.join(UPLOAD_DIR, fileId);
            const ws = fs.createWriteStream(finalPath);
            for (let i = 0; i < tot; i++) {
                const part = fs.readFileSync(path.join(chunkDir, String(i)));
                ws.write(part);
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

export function getFileInfo(req, res) {
    const filePath = path.join(UPLOAD_DIR, req.params.fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }

    let name = path.basename(filePath);
    const metaPath = path.join(UPLOAD_DIR, `${req.params.fileId}.json`);
    if (fs.existsSync(metaPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (parsed.name) name = parsed.name;
        } catch {}
    }

    const size = fs.statSync(filePath).size;
    return res.json({ name, size });
}

export function downloadFile(req, res) {
    const filePath = path.join(UPLOAD_DIR, req.params.fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Not found');
    }

    let originalName = path.basename(filePath);
    const metaPath = path.join(UPLOAD_DIR, `${req.params.fileId}.json`);
    if (fs.existsSync(metaPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (parsed.name) originalName = parsed.name;
        } catch {}
    }

    return res.download(filePath, originalName);
}

export function getUploadStatus(req, res) {
    try {
        const { fileId } = req.query;
        if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

        const chunkDir = path.join(UPLOAD_DIR, String(fileId));
        const finalPath = path.join(UPLOAD_DIR, String(fileId));

        let uploaded = [];
        if (fs.existsSync(chunkDir)) {
            uploaded = fs.readdirSync(chunkDir)
                .filter(n => /^\d+$/.test(n))
                .map(n => parseInt(n, 10))
                .sort((a,b)=>a-b);
        }

        const finalized = fs.existsSync(finalPath) && !fs.existsSync(chunkDir);

        return res.json({ uploaded, finalized });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Server error' });
    }
}
