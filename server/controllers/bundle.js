import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');

if (!SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
}

// GET /api/bundle/:token
export async function bundleDownload(req, res) {
    let payload;
    try {
        payload = jwt.verify(req.params.token, SECRET);
    } catch {
        return res.status(400).send('Invalid or expired token');
    }

    if (!payload.fileIds || !Array.isArray(payload.fileIds)) {
        return res.status(400).send('Invalid payload');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="files.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    for (const fileId of payload.fileIds) {
        const filePath = path.join(UPLOAD_DIR, fileId);
        if (!fs.existsSync(filePath)) continue;

        let name = fileId;
        const metaPath = path.join(UPLOAD_DIR, `${fileId}.json`);
        if (fs.existsSync(metaPath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                if (parsed.name) name = parsed.name;
            } catch {}
        }

        archive.file(filePath, { name });
    }

    archive.finalize();
}
