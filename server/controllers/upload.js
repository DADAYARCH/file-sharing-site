/* eslint-env node */
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');

// Обрабатывает POST /api/upload-chunk?fileId=...&index=...&total=...
export async function handleChunkUpload(req, res) {
    try {
        const { fileId, index, total } = req.query;
        if (!fileId || index == null || total == null) {
            return res.status(400).json({ error: 'Missing fileId, index or total' });
        }
        const idx   = parseInt(index, 10);
        const tot   = parseInt(total,  10);
        const chunkDir = path.join(UPLOAD_DIR, String(fileId));
        fs.mkdirSync(chunkDir, { recursive: true });

        // Сохраняем текущий чанк
        const chunkPath = path.join(chunkDir, String(idx));
        fs.writeFileSync(chunkPath, req.body);

        // Если это последний чанк — собираем в один файл
        if (idx === tot - 1) {
            const finalPath = path.join(UPLOAD_DIR, String(fileId));
            const writeStream = fs.createWriteStream(finalPath);
            for (let i = 0; i < tot; i++) {
                const buf = fs.readFileSync(path.join(chunkDir, String(i)));
                writeStream.write(buf);
            }
            writeStream.end();
            // Удаляем папку с временными чанками
            fs.rmSync(chunkDir, { recursive: true, force: true });
        }

        return res.json({ status: 'ok', index: idx });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

// Обрабатывает GET /api/files/:fileId
export function getFileInfo(req, res) {
    const { fileId } = req.params;
    const filePath = path.join(UPLOAD_DIR, fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }
    const stat = fs.statSync(filePath);
    res.json({ name: path.basename(filePath), size: stat.size });
}

// Обрабатывает GET /api/files/:fileId/download
export function downloadFile(req, res) {
    const { fileId } = req.params;
    const filePath = path.join(UPLOAD_DIR, fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Not found');
    }
    res.download(filePath);
}
