import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'super-secret-change-me';

// POST /api/link
export function createLink(req, res) {
    const { fileIds, expiresAt } = req.body;
    if (!Array.isArray(fileIds) || typeof expiresAt !== 'number') {
        return res.status(400).json({ error: 'Invalid payload' });
    }
    const ttlSeconds = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
    const token = jwt.sign({ fileIds }, SECRET, { expiresIn: ttlSeconds + 's' });
    res.json({ token });
}

// GET /api/link/:token
export function validateLink(req, res) {
    try {
        const payload = jwt.verify(req.params.token, SECRET);
        res.json(payload);
    } catch (e) {
        res.status(400).json({ error: 'Invalid or expired token' });
    }
}
