import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');
const router = Router();


router.get('/files/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const filePath = path.join(UPLOAD_DIR, fileId);
    const metaPath = filePath + '.meta.json';

    if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        return res.status(404).json({ error: 'Not found' });
    }

    const stat = fs.statSync(filePath);
    const { originalName } = JSON.parse(fs.readFileSync(metaPath, 'utf‑8'));
    return res.json({ name: originalName, size: stat.size });
});


router.get('/files/:fileId/download', (req, res) => {
    const fileId = req.params.fileId;
    const filePath = path.join(UPLOAD_DIR, fileId);
    const metaPath = filePath + '.meta.json';

    if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        return res.status(404).send('Not found');
    }

    const { originalName } = JSON.parse(fs.readFileSync(metaPath, 'utf‑8'));
    return res.download(filePath, originalName);
});

export default router;
