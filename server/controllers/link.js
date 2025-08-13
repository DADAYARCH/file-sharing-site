/* eslint-env node */

import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const SECRET = process.env.JWT_SECRET;
const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');

if (!SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
}

// POST /api/link
export function createLink(req, res) {
    const { fileIds, expiresAt } = req.body;
    if (!Array.isArray(fileIds) || typeof expiresAt !== 'number') {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    const ttlSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
    const token = jwt.sign({ fileIds }, SECRET, { expiresIn: ttlSeconds + 's' });

    setTimeout(() => {
        for (const id of fileIds){
            const filePath = path.join(UPLOAD_DIR, id);
            const metaPath = path.join(UPLOAD_DIR, id + '.json');
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        }
    }, ttlSeconds * 1000);
    res.json({ token });
}

// GET /api/link/:token
export function validateLink(req, res) {
    try {
        const payload = jwt.verify(req.params.token, SECRET);
        res.json(payload);
    } catch (e) {
        res.status(410).json({ error: 'Link expired or invalid' });
    }
}
